//------------------------------------------------------------------------------
// Watcher uses the game-stream API from Lichess to listen for games as they
// start and end.
//------------------------------------------------------------------------------

// Previous imports
import _ from "lodash";
import {ClientRequest} from "http";
import _https from "https";
import url from "url";
import winston from "winston";
import moment from "moment-timezone";

// local imports
import _league from "./league";
import games from "./commands/games";
import heltour from "./heltour";


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

// TODO: make all of thes typed.
type SlackBot = any;
type League = any;
type GameDetails = any;
type RandomError = any;

class Watcher {
    req: undefined | ClientRequest = null;
    usernames: String[] = [];
    private logPreMatter: String;
    private info: (msg: String) => void;
    private warn: (msg: String) => void;
    private error: (msg: String) => void;
    private started: moment.Moment;

    constructor(
        public bot: SlackBot,
        public league: League
    ) {
        let self = this;
        self.logPreMatter = `[Watcher] ${league.options.name}: `;
        self.info = (msg: String) => winston.info(`${this.logPreMatter} ${msg}`);
        self.warn = (msg: String) => winston.warn(`${this.logPreMatter} ${msg}`);
        self.error = (msg: String) => winston.error(`${this.logPreMatter} ${msg}`);

        self.info("Watching");

        self.league.onRefreshPairings(function () {
            var white = _.map(league._pairings, "white");
            var black = _.map(league._pairings, "black");
            var newUsernames = _.uniq(_.concat(white, black));
            newUsernames.sort();
            // TODO: why are we using union here?
            var union = _.union(newUsernames, self.usernames);
            if (self.usernames.length - union.length !== 0) {
                self.info(
                    `${self.usernames.length}` +
                    ` old usernames ${newUsernames.length} incoming usernames` +
                    ` ${self.usernames.length - union.length} differences`
                );
                self.info(`Restarting because usernames have changed`);
                self.usernames = newUsernames;
                self.watch();
            }
        });

    }

    //--------------------------------------------------------------------------
    watch() {
        let self = this;

        // Ensure we close/abort any previous request before starting a new one.
        if (self.req) {
            self.req.abort();
            self.req = null;
            return; // The .on('end') handler will restart us.
        }

        // Guard against hammering lichess when it's down and feeding us errors.
        // In this case, if we get two errors in 10s, we'll wait till the next
        // refressh which will eventually wait 2 minutes between requests.
        let lastStarted = self.started;
        self.started = moment.utc();
        if (lastStarted && self.started.unix() - lastStarted.unix() < BACKOFF_TIMEOUT) {
            self.warn(`Backing off the watcher due to two starts in 10s: ${self.started.unix() - lastStarted.unix()}s`);
            self.usernames = [];
            return;
        }
        var body = self.usernames.join(",");
        self.info(`Watching ${self.bot.config.watcherBaseURL} with ${body} users`);
        var options = url.parse(self.bot.config.watcherBaseURL);
        var hasResponse = false;
        self.req = _https.request({
            method: "POST",
            headers: {
                "Content-Length": Buffer.byteLength(body)
            },
            ...options
        });
        self.req.on('response', function (res) {
            res.on('data', function (chunk) {
                try {
                    var details = JSON.parse(chunk.toString());
                    self.info(`Received game details: ${JSON.stringify(details)}`);
                    self.league.refreshCurrentRoundSchedules().then(function () {
                        self.processGameDetails(details);
                    }).catch(function (error: RandomError) {
                        self.error(`Error refreshing pairings: ${JSON.stringify(error)}`);
                    });
                } catch (e) {
                    self.error(JSON.stringify(e));
                    self.error("Ending request due to error in content");
                    self.req.abort();
                    self.req = null;
                }
            });
            res.on('end', () => {
                self.info("Watcher response ended");
                self.req = null;
                self.watch();
            });
            hasResponse = true;
        }).on('error', (e: RandomError) => {
            self.error(JSON.stringify(e));
            // If we have a response, the above res.on('end') gets called even in this case.
            // So let the above restart the watcher
            if (!hasResponse) {
                self.req = null;
                self.watch();
            }
        });
        // Setting 0 for initialDelay (2nd param) will leave the value
        // unchanged from the default (or previous) setting.
        self.req.setSocketKeepAlive(true, 0);
        self.req.write(body);
        self.req.end();
    };

    //--------------------------------------------------------------------------
    processGameDetails(details: GameDetails) {
        let self = this;

        // 1. perfect match any time, try to update.
        // 2. pairing + time control match any time, warn for other mismatches 
        // 3. pairing match during a 4 hour window (+-2 hours), warn for other mismatches

        var result = games.validateGameDetails(self.league, details);
        let result_string = JSON.stringify(result);
        self.info(`Validation result: ${result_string}`);
        // If we don't have a pairing from this information, then it will
        // never be valid. Ignore it.
        if (!result.pairing) {
            self.info(`No pairing so ignoring!`);
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
                self.info(`Received VALID game but result already exists`);
                if (details.status === STARTED) {
                    self.bot.say({
                        text: `<@${white}>,  <@${black}>:`
                            + " There is already a result set for this pairing. If you want "
                            + "the new game to count for the league, please contact a mod.",
                        channel: self.league.options.gamelinks.channel_id
                    });
                }
            } else if (result.pairing.game_link && !result.pairing.game_link.endsWith(details.id)) {
                self.info(`Received VALID game but game link does not match`);
                if (details.status === STARTED) {
                    self.bot.say({
                        text: `<@${white}>,  <@${black}>:`
                            + " There is already a gamelink set for this pairing. If you want "
                            + "the new game to count for the league, please contact a mod.",
                        channel: self.league.options.gamelinks.channel_id
                    });
                }
            } else {
                self.info("Received VALID AND NEEDED game!");
                // Fetch the game details from the lichess games API because updateGamelink is more picky about the details format
                // This could be obviated by an enhancement to the game-stream API
                games.fetchGameDetails(details.id).then(function (response) {
                    var detailsFromApi = response['json'];
                    games.updateGamelink(self.league, detailsFromApi).then(function (updatePairingResult) {
                        if (updatePairingResult.gamelinkChanged) {
                            self.bot.say({
                                text: "<@" + white + "> vs <@" + black + ">: <"
                                    + updatePairingResult.gamelink + ">",
                                channel: self.league.options.gamelinks.channel_id,
                                attachments: [] // Needed to activate link parsing in the message
                            });
                        }
                        if (updatePairingResult.resultChanged) {
                            self.bot.say({
                                text: "<@" + white + "> " + updatePairingResult.result + " <@" + black + ">",
                                channel: self.league.options.results.channel_id
                            });
                        }
                    }).catch(function (error) {
                        self.error(`Error updating game: ${JSON.stringify(error)}`);
                    });
                }).catch(function (error) {
                    self.error(`Error fetching game details: ${JSON.stringify(error)}`);
                });
            }
        } else if (details.status === STARTED || result.claimVictoryNotAllowed || result.cheatDetected) {
            self.info("Received INVALID game");

            var hours = Math.abs(now.diff(scheduledDate));
            if ((!scheduledDate || hours >= 2) && result.timeControlIsIncorrect) {
                // If the game is not the right time control,
                // and we are not within 2 hours either way
                // of the scheduled time, then don't warn.
                return;
            }

            self.info("Sending warning");
            self.bot.say({
                text: "<@" + white + ">,  <@" + black + ">:"
                    + " Your game is *not valid* because "
                    + "*" + result.reason + "*",
                channel: self.league.options.gamelinks.channel_id
            });
            self.bot.say({
                text: "If this was a mistake, please correct it and "
                    + "try again. If this is not a league game, you "
                    + "may ignore this message. Thank you.",
                channel: self.league.options.gamelinks.channel_id
            });
            heltour.sendGameWarning(self.league.options.heltour, white, black, result.reason).catch(function (error) {
                self.error(`Error sending game warning: ${JSON.stringify(error)}`);
            });
        }
    };
};


var watcherMap: {[key: string]: Watcher} = {};

//------------------------------------------------------------------------------
export function watchAllLeagues(bot: SlackBot) {
    _.each(_league.getAllLeagues(bot, bot.config), function (league) {
        watcherMap[league.name] = new Watcher(bot, league);
    });
};

export function getWatcher(league: League) {
    return watcherMap[league.name];
};
