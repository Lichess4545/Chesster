const _ = require('lodash');
const _https = require('https');
const url = require("url");
const winston = require("winston");
const format = require('string-format');
format.extend(String.prototype);
const _league = require("./league.js");
const games = require("./commands/games.js");

var baseURL = "https://en.lichess.org/api/game-stream?users="

const CREATED = 10;
const STARTED = 20;
const ABORTED = 25;
const MATE = 30;
const RESIGN = 31;
const STALEMATE = 32;
const TIMEOUT = 33;
const DRAW = 34;
const OUT_OF_TIME = 35;
const CHEAT = 36;
const NO_START = 37;
const UNKNOWN_FINISH = 38;
const VARIANT_END = 60

//------------------------------------------------------------------------------
function Watcher(bot, league) {
    var self = this;
    self.league = league;
    self.bot = bot;
    self.req = null;
    self.usernames = [];

    self.league.onRefreshRosters(function(players) {
        var newUsernames = [];
        _.each(league._players, function(player) {
            newUsernames.push(player.username);
        });
        newUsernames.sort();
        winston.info("-----------------------------------------------------");
        winston.info("{} old usernames {} incoming usernames".format(
            self.usernames.length,
            newUsernames.length
        ));
        var union = _.union(newUsernames, self.usernames);
        winston.info("{} differences".format(self.usernames.length - union.length));
        if (self.usernames.length - union.length != 0) {
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
        console.log(details);

        var result = games.validateGameDetails(self.league, details);
        // If we don't have a pairing from this information, then it will
        // never be valid. Ignore it.
        if (!result.pairing) {
            return;
        }
        console.log(result.pairing);

        var scheduledDate = moment.utc(result.pairing.datetime);
        var now = moment.utc();
        if (!scheduledDate.isValid()) {
            scheduledDate = undefined;
        }
        console.log("Scheduled Date: {}".format(scheduleDate));

        if (result.isValid) {
            if (result.pairing.game_link) {
                console.log("VALID But overwriting!");
            } else {
                // TODO: check to ensure we are not overwriting.
                console.log("VALID AND NEEDED!");
            }
        } else {
            var warn = false;
            var hours = Math.abs(now.diff(scheduledDate));
            if (hours >= 2 || result.timeControlIsIncorrect) {
                // If the game is not the right time control,
                // and we are not within 2 hours either way
                // of the scheduled time, then don't warn.
                return;
            }

            var heltourOptions = self.league.options.heltour;
            self.bot.say({
                text: "I am sorry, <@" + message.user + ">,  "
                    + "your post is *not valid* because "
                    + "*" + result.reason + "*",
                channel: self.league.options.gamelinks.channel_id,
            });
            self.bot.say({
                text: "If this was a mistake, please correct it and "
                     + "try again. If intentional, please contact one "
                     + "of the moderators for review. Thank you.",
                channel: self.league.options.gamelinks.channel_id,

            });
        }
    }

    //--------------------------------------------------------------------------
    self.watch = function(usernames) {
        if (self.req) {
            self.req.end();
        }
        var watchURL = baseURL + usernames.join(",");
        console.log("watching " + watchURL);
        winston.info("============================================================");
        self.req = _https.get(url.parse(watchURL));
        return self.req.on('response', function (res) {
            res.on('data', function (chunk) {
                var details = JSON.parse(chunk.toString());
                self.processGameDetails(details);
            });
            res.on('end', () => {
                self.req = null;
                self.watch(usernames);
            });
        }).on('error', (e) => {
            console.error(JSON.stringify(e));
            self.req = null;
            self.watch(usernames);
        });
    }
}

//------------------------------------------------------------------------------
var watch = function(bot) {
    _.each(_league.getAllLeagues(bot.config), function(league) {
        console.log("Watching: {}".format(league.options.name));
        new Watcher(bot, league);
    });
}

module.exports.watch = watch;

