//------------------------------------------------------------------------------
// Commands related to player information
//------------------------------------------------------------------------------
const Q = require("q");
const _ = require("lodash");
const winston = require("winston");

const slack = require('../slack.js');
const lichess = require('../lichess.js');
const league = require('../league.js');


function prepareRatingMessage(_player, rating){
    return _player + " is rated " + rating + " in classical chess";
}

function playerRating(bot,message)  {
    var playerName = slack.getSlackUser(message).name;
    return lichess.getPlayerRating(playerName).then(function(rating) {
        if(rating){
            bot.reply(message, prepareRatingMessage(playerName, rating));
        }else{
            bot.reply(message, "I am sorry. I could not find that player.");
        }
    });
}

function playerPairings(config) {
    return function(bot, message) {
        var targetPlayer = slack.getSlackUser(message);
        var deferred = Q.defer();
        var allLeagues = league.getAllLeagues(config);
        bot.startPrivateConversation(message, function (response, convo) {
            Q.all(
                _.map(allLeagues, function(l) {
                    return l.getPairingDetails(targetPlayer).then(function(details) {
                        if (details && details.opponent) {
                            return l.formatPairingResponse(message.player, details).then(function(response) {
                                convo.say(response);
                            });
                        } else {
                            convo.say("[" + l.options.name + "] Unable to find pairing for " + targetPlayer.name);
                        }
                    }, function(error) {
                        winston.error("error");
                        winston.error(JSON.stringify(error));
                    });
                })
            ).then(function() {
                deferred.resolve();
            }, function(error) {
                deferred.reject(error);
            });
        });
        return deferred.promise;
    }
}

module.exports.playerRating = playerRating;
module.exports.playerPairings = playerPairings;
