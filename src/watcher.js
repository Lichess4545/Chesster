const _ = require('lodash');
const _https = require('https');
const url = require("url");
const winston = require("winston");
const format = require('string-format');
format.extend(String.prototype);
const _league = require("./league.js");

var baseURL = "https://en.lichess.org/api/game-stream?users="

//------------------------------------------------------------------------------
function Watcher(bot, league) {
    var self = this;
    self.league = league;
    self.bot = bot;
    self.req = null;

    self.league.onRefreshRosters(function(players) {
        self.watch(players);
    });

    //--------------------------------------------------------------------------
    self.processGameDetails = function (details) {
        console.log(details);
        _.each(_league.getAllLeagues(), function(league) {
            var white = details.players.white.userId;
            var black = details.players.black.userId;

            var potentialPairings = league.findPairing(white, black);
            if(potentialPairings.length === 0) {
                return;
            } else if (potentialPairings.length === 2) {
                winston.error(
                    "Got multiple pairings for the {} vs {} in {} league".format(
                        white, black, league.options.name
                    )
                );
            }
            var heltourOptions = league.options.heltour;
            pairing = potentialPairings[0];
            var result = league.validateGameDetails(details);
            if (!results.valid) {
                console.log("Got game!");
                bot.say({
                    text: "I am sorry, <@" + message.user + ">,  "
                        + "your post is *not valid* because "
                        + "*" + reason + "*",
                    channel: league.options.gamelinks.channel_id,
                });
                bot.reply(message, "If this was a mistake, please correct it and "
                                 + "try again. If intentional, please contact one "
                                 + "of the moderators for review. Thank you.");
            }
        });
    }

    //--------------------------------------------------------------------------
    self.watch = function(players) {
        if (self.req) {
            self.req.end();
        }
        var usernames = [];
        _.each(league._players, function(player) {
            usernames.push(player.username);
        });
        var watchURL = baseURL + usernames.join(",");
        console.log("watching " + watchURL);
        self.req = _https.get(url.parse(watchURL));
        return self.req.on('response', function (res) {
            res.on('data', function (chunk) {
                var details = JSON.parse(chunk.toString());
                self.processGameDetails(details);
            });
            res.on('end', () => {
                self.req = null;
                self.watch(players);
            });
        }).on('error', (e) => {
            console.error(JSON.stringify(e));
            self.req = null;
            self.watch(players);
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

