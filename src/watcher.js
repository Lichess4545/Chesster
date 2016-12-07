//------------------------------------------------------------------------------
// Watcher uses the game-stream API from Lichess to listen for games as they
// start and end.
//------------------------------------------------------------------------------
const _ = require('lodash');
const _https = require('https');
const url = require("url");
const winston = require("winston");
const moment = require("moment-timezone");
const format = require('string-format');
format.extend(String.prototype);
const _league = require("./league.js");
const games = require('./commands/games.js');

var baseURL = "https://en.lichess.org/api/game-stream";

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

//------------------------------------------------------------------------------
function Watcher(bot, league) {
    var self = this;
    self.league = league;
    self.bot = bot;
    self.req = null;
    self.usernames = [];

    self.league.onRefreshPairings(function() {
        var white = _.map(league._pairings, "white");
        var black = _.map(league._pairings, "black");
        var newUsernames = _.uniq(_.concat(white, black));
        newUsernames.sort();
        winston.info("-----------------------------------------------------");
        winston.info("{} old usernames {} incoming usernames".format(
            self.usernames.length,
            newUsernames.length
        ));
        var union = _.union(newUsernames, self.usernames);
        winston.info("{} differences".format(self.usernames.length - union.length));
        if (self.usernames.length - union.length !== 0) {
            winston.info("Restarting watcher because usernames have changed");
            self.usernames = newUsernames;
            self.watch(self.usernames);
        }
    });

    //--------------------------------------------------------------------------
    self.processGameDetails = function (details) {
        // 1. perfect match any time, try to update.
        // 2. pairing + time control match any time, warn for other mismatches 
        // 3. pairing match during a 4 hour window (+-2 hours), warn for other mismatches
        winston.info("Watcher received game details: {}".format(JSON.stringify(details)));

        var result = games.validateGameDetails(self.league, details);
        winston.info("Watcher validation result: {}".format(result));
        // If we don't have a pairing from this information, then it will
        // never be valid. Ignore it.
        if (!result.pairing) {
            winston.info("No pairing so ignoring!");
            return;
        }

        var scheduledDate = moment.utc(result.pairing.datetime);
        var now = moment.utc();
        if (!scheduledDate.isValid()) {
            scheduledDate = undefined;
        }

        if (result.valid) {
            if (result.pairing.result) {
                winston.info("Watcher received VALID game but result already exists");
                if (details.status === STARTED) {
                    self.bot.say({
                        text: "<@" + result.pairing.white + ">,  <@" + result.pairing.black + ">:"
                            + " There is already a result set for this pairing. If you want "
                            + "the new game to count for the league, please contact a mod.",
                        channel: self.league.options.gamelinks.channel_id
                    });
                }
            } else if (result.pairing.game_link && !result.pairing.game_link.endsWith(details.id)) {
                winston.info("Watcher received VALID game but game link does not match");
                if (details.status === STARTED) {
                    self.bot.say({
                        text: "<@" + result.pairing.white + ">,  <@" + result.pairing.black + ">:"
                            + " There is already a gamelink set for this pairing. If you want "
                            + "the new game to count for the league, please contact a mod.",
                        channel: self.league.options.gamelinks.channel_id
                    });
                }
            } else {
                winston.info("Watcher received VALID AND NEEDED game!");
                // Fetch the game details from the lichess games API because updateGamelink is more picky about the details format
                // This could be obviated by an enhancement to the game-stream API
                games.fetchGameDetails(details.id).then(function(response) {
                    var detailsFromApi = response['json'];
                    games.updateGamelink(self.league, detailsFromApi).then(function(updatePairingResult) {
                        if (updatePairingResult.gamelinkChanged) {
                            self.bot.say({
                                text: "<@" + result.pairing.white + "> vs <@" + result.pairing.black + ">: <"
                                    + updatePairingResult.gamelink +">",
                                channel: self.league.options.gamelinks.channel_id,
                                attachments: [] // Needed to activate link parsing in the message
                            });
                        }
                        if (updatePairingResult.resultChanged) {
                            self.bot.say({
                                text: "<@" + result.pairing.white + "> " + updatePairingResult.result + " <@" + result.pairing.black + ">",
                                channel: self.league.options.results.channel_id
                            });
                        }
                    }).catch(function(error) {
                        winston.error("Error updating game in watcher: {}".format(JSON.stringify(error)));
                    });
                }).catch(function(error) {
                    winston.error("Error fetching game details in watcher: {}".format(JSON.stringify(error)));
                });
            }
        } else if (details.status === STARTED) {
            winston.info("Watcher received INVALID game");

            var hours = Math.abs(now.diff(scheduledDate));
            if ((!scheduledDate || hours >= 2) && result.timeControlIsIncorrect) {
                // If the game is not the right time control,
                // and we are not within 2 hours either way
                // of the scheduled time, then don't warn.
                return;
            }

            winston.info("Sending warning");
            self.bot.say({
                text: "<@" + result.pairing.white + ">,  <@" + result.pairing.black + ">:"
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
        }
    };

    //--------------------------------------------------------------------------
    self.watch = function(usernames) {
        // Ensure we close/abort any previous request before starting a new one.
        if (self.req) {
            self.req.abort();
            self.req = null;
            return; // The .on('end') handler will restart us.
        }

        // Guard against hammering lichess when it's down and feeding us errors.
        // In this case, if we get two errors in 10s, we'll wait till the next
        // refressh which will eventually wait 2 minutes between requests.
        self.lastStarted = self.started;
        self.started = moment.utc();
        if (self.lastStarted && self.started.unix() - self.lastStarted.unix() < BACKOFF_TIMEOUT) {
            winston.warn("[Watcher] {} - Backing off the watcher due to two starts in 10s: {}s".format(
                self.league.options.name,
                self.started.unix() - self.lastStarted.unix()
            ));
            self.usernames = [];
            return;
        }
        var body = usernames.join(",");
        winston.info("watching {} with {} users".format(baseURL, body));
        winston.info("============================================================");
        var options = url.parse(baseURL);
        options.method = "POST";
        options.headers = {
            "Content-Length": Buffer.byteLength(body)
        };
        self.req = _https.request(options);
        self.req.on('response', function (res) {
            res.on('data', function (chunk) {
                try {
                    var details = JSON.parse(chunk.toString());
                    self.processGameDetails(details);
                } catch (e) {
                    winston.error("[Watcher]: {}".format(JSON.stringify(e)));
                    winston.error("[Watcher]: Ending request due to error in content");
                    self.req.abort();
                    self.req = null;
                }
            });
            res.on('end', () => {
                self.req = null;
                self.watch(usernames);
            });
        }).on('error', (e) => {
            winston.error("[Watcher]: " + JSON.stringify(e));
            // the above res.on('end') gets called even in this case.
            // So let the above restart the watcher
        });
        self.req.write(body);
        self.req.end();
    };
}

var watcherMap = {};

//------------------------------------------------------------------------------
var watchAllLeagues = function(bot) {
    _.each(_league.getAllLeagues(bot.config), function(league) {
        winston.info("Watching: {}".format(league.options.name));
        watcherMap[league.name] = new Watcher(bot, league);
    });
};

var getWatcher = function(league) {
    return watcherMap[league.name];
};

module.exports.watchAllLeagues = watchAllLeagues;
module.exports.getWatcher = getWatcher;
