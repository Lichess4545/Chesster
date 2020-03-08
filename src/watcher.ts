//------------------------------------------------------------------------------
// Watcher uses the game-stream API from Lichess to listen for games as they
// start and end.
//------------------------------------------------------------------------------

// Previous imports
import _ from "lodash";
import fp from "lodash/fp";
import {ClientRequest} from "http";
import _https from "https";
import url from "url";
import winston from "winston";
import moment from "moment-timezone";
import Q from 'q'

// local imports
import games from "./commands/games";
import heltour from "./heltour";

const WATCHER_MAX_USERNAMES = 300;

const BACKOFF_TIMEOUT = 10;
// const CREATED = 10;
const STARTED = 20;
// const ABORTED = 25;
// const MATE = 30;
// const RESIGN = 31;
// const STALEMATE = 32;
// const TIMEOUT = 33;
// const DRAW = 34;
// const OUT_OF_TIME = 35;
// const CHEAT = 36;
// const NO_START = 37;
// const UNKNOWN_FINISH = 38;
// const VARIANT_END = 60;

// TODO: make all of these typed.
type SlackBot = any;
type League = any;
type GameDetails = any;
type RandomError = any;
type Player = any;
type Logger = (msg: String) => void;

class WatcherRequest {
    req: undefined | ClientRequest = null;
    private started?: moment.Moment;
    private info: Logger;
    private warn: Logger;
    private error: Logger;
    private logPreMatter: String;

    constructor(
        public bot: SlackBot,
        public usernames: String[],
        public leagues: League[]
    ) {
        this.logPreMatter = `[WatcherRequest]`;
        this.info = (msg: String) => winston.info(`${this.logPreMatter} ${msg}`);
        this.warn = (msg: String) => winston.warn(`${this.logPreMatter} ${msg}`);
        this.error = (msg: String) => winston.error(`${this.logPreMatter} ${msg}`);
    }

    watch() {
        if (this.stop()) {
            return; // The .on('end') handler will restart us.
        }

        // Guard against hammering lichess when it's down and feeding us errors.
        // In this case, if we get two errors in 10s, we'll wait till the next
        // refressh which will eventually wait 2 minutes between requests.
        let lastStarted = this.started;
        this.started = moment.utc();
        if (lastStarted && this.started.unix() - lastStarted.unix() < BACKOFF_TIMEOUT) {
            this.warn(`Backing off the watcher due to two starts in 10s: ${this.started.unix() - lastStarted.unix()}s`);
            this.usernames = [];
            return;
        }
        var body = this.usernames.join(",");
        this.info(`Watching ${this.bot.config.watcherBaseURL} with ${body} users`);
        var options = url.parse(this.bot.config.watcherBaseURL);
        var hasResponse = false;
        this.req = _https.request({
            method: "POST",
            headers: {
                "Content-Length": Buffer.byteLength(body)
            },
            ...options
        });
        this.req.on('response', res => {
            res.on('data', chunk => {
                try {
                    var details = JSON.parse(chunk.toString());
                    this.info(`Received game details: ${JSON.stringify(details)}`);
                    Q.all(this.leagues.map(l => l.refreshCurrentRoundSchedules())).then(() => {
                        this.processGameDetails(details);
                    }, error => {
                        this.error(`Error refreshing pairings: ${JSON.stringify(error)}`);
                    });
                } catch (e) {
                    this.error(JSON.stringify(e));
                    this.error("Ending request due to error in content");
                    this.req.abort();
                    this.req = null;
                }
            });
            res.on('end', () => {
                this.info("WatcherRequest response ended");
                this.req = null;
                this.watch();
            });
            hasResponse = true;
        }).on('error', (e: RandomError) => {
            this.error(JSON.stringify(e));
            // If we have a response, the above res.on('end') gets called even in this case.
            // So let the above restart the watcher
            if (!hasResponse) {
                this.req = null;
                this.watch();
            }
        });
        // Setting 0 for initialDelay (2nd param) will leave the value
        // unchanged from the default (or previous) setting.
        this.req.setSocketKeepAlive(true, 0);
        this.req.write(body);
        this.req.end();
    }

    stop() {
        // Ensure we close/abort any previous request before starting a new one.
        if (this.req) {
            this.req.abort();
            this.req = null;
            return true;
        }
        return false;
    }

    //--------------------------------------------------------------------------
    processGameDetails(details: GameDetails) {
        fp.each(league => {
            // 1. perfect match any time, try to update.
            // 2. pairing + time control match any time, warn for other mismatches 
            // 3. pairing match during a 4 hour window (+-2 hours), warn for other mismatches

            var result = games.validateGameDetails(league, details);
            this.info(`Validation result: ${JSON.stringify(result)}`);
            // If we don't have a pairing from this information, then it will
            // never be valid. Ignore it.
            if (!result.pairing) {
                this.info(`No pairing so ignoring!`);
                return;
            }
            var white = result.pairing.white.toLowerCase();
            var black = result.pairing.black.toLowerCase();

            var scheduledDate = moment.utc(result.pairing.datetime);
            var now = moment.utc();
            if (!scheduledDate.isValid()) {
                scheduledDate = undefined;
            }

            if (result.valid) {
                if (result.pairing.result) {
                    this.info(`Received VALID game but result already exists`);
                    if (details.status === STARTED) {
                        this.bot.say({
                            text: `<@${white}>,  <@${black}>:`
                                + " There is already a result set for this pairing. If you want "
                                + "the new game to count for the league, please contact a mod.",
                            channel: league.options.gamelinks.channel_id
                        });
                    }
                } else if (result.pairing.game_link && !result.pairing.game_link.endsWith(details.id)) {
                    this.info(`Received VALID game but game link does not match`);
                    if (details.status === STARTED) {
                        this.bot.say({
                            text: `<@${white}>,  <@${black}>:`
                                + " There is already a gamelink set for this pairing. If you want "
                                + "the new game to count for the league, please contact a mod.",
                            channel: league.options.gamelinks.channel_id
                        });
                    }
                } else {
                    this.info("Received VALID AND NEEDED game!");
                    // Fetch the game details from the lichess games API because updateGamelink is more picky about the details format
                    // This could be obviated by an enhancement to the game-stream API
                    games.fetchGameDetails(details.id).then(response => {
                        var detailsFromApi = response['json'];
                        games.updateGamelink(league, detailsFromApi).then(updatePairingResult => {
                            if (updatePairingResult.gamelinkChanged) {
                                this.bot.say({
                                    text: "<@" + white + "> vs <@" + black + ">: <"
                                        + updatePairingResult.gamelink + ">",
                                    channel: league.options.gamelinks.channel_id,
                                    attachments: [] // Needed to activate link parsing in the message
                                });
                            }
                            if (updatePairingResult.resultChanged) {
                                this.bot.say({
                                    text: `<@${white}> ${updatePairingResult.result} <@${black}>`,
                                    channel: league.options.results.channel_id
                                });
                            }
                        }).catch(error => {
                            this.error(`Error updating game: ${JSON.stringify(error)}`);
                        });
                    }).catch(error => {
                        this.error(`Error fetching game details: ${JSON.stringify(error)}`);
                    });
                }
            } else if (details.status === STARTED || result.claimVictoryNotAllowed || result.cheatDetected) {
                this.info("Received INVALID game");

                var hours = Math.abs(now.diff(scheduledDate));
                if ((!scheduledDate || hours >= 2) && result.timeControlIsIncorrect) {
                    // If the game is not the right time control,
                    // and we are not within 2 hours either way
                    // of the scheduled time, then don't warn.
                    return;
                }

                this.info("Sending warning");
                this.bot.say({
                    text: "<@" + white + ">,  <@" + black + ">:"
                        + " Your game is *not valid* because "
                        + "*" + result.reason + "*",
                    channel: league.options.gamelinks.channel_id
                });
                this.bot.say({
                    text: "If this was a mistake, please correct it and "
                        + "try again. If this is not a league game, you "
                        + "may ignore this message. Thank you.",
                    channel: league.options.gamelinks.channel_id
                });
                heltour.sendGameWarning(league.options.heltour, white, black, result.reason).catch(error => {
                    this.error(`Error sending game warning: ${JSON.stringify(error)}`);
                });
            }
        }, this.leagues);
    }
}

export default class Watcher {
    watcherRequests: WatcherRequest[];
    usernames: String[] = [];
    private refreshesCount: number = 0;

    private info: Logger;
    private logPreMatter: String;

    constructor(
        public bot: SlackBot,
        public leagues: League[]
    ) {
        this.watcherRequests = [];
        this.logPreMatter = `[Watcher]`;
        this.info = (msg: String) => winston.info(`${this.logPreMatter} ${msg}`);
        this.info("Starting watcher");

        // Whenever any of the leagues refresh, potentially restart watcher requests
        this.leagues.map(l => l.onRefreshPairings(() => {
            this.info(`${l.options.name} refreshed with ${l._pairings.length} pairings`);
            this.refreshesCount++;
            if (this.refreshesCount >= this.leagues.length) {
                this.watch();
            }
        }));
    }

    clear() {
        this.watcherRequests.map(r => r.stop());
        this.watcherRequests = [];
    }

    watch() {
        let newUsernames = _.uniq(
            fp.flatMap(l => l._pairings, this.leagues)
                .flatMap((p: Player) => [p.white, p.black])
                .sort()
        );
        if (!_.isEqual(newUsernames, this.usernames)) {
            this.info(`Restarting because usernames have changed`);
            this.clear();
            this.usernames = newUsernames;
            this.info(`Watching with ${this.usernames.length} names`);
            let i = 0;
            while (i < this.usernames.length) {
                let watcherUsernames = _.slice(this.usernames, i, i + WATCHER_MAX_USERNAMES);
                let req = new WatcherRequest(this.bot, watcherUsernames, this.leagues);
                req.watch();
                this.watcherRequests.push(req);
                i += WATCHER_MAX_USERNAMES;
            }
            this.info(`Watching with ${this.watcherRequests.length} requests`);
        }

    }
}
