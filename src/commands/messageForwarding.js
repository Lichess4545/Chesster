const _ = require("lodash");
const Q = require("q");
const winston = require("winston");
const commands = require("../commands");
const league = require("../league");

function forwardMessage(chesster, adminSlack) {
    return function(bot, message) {
        if (!_.isEqual(message.channel, adminSlack.config.messageForwarding.channel)) {
            return;
        }
        var commandDescription = [
            "forward",
            "to",
            "{text:targets}"
        ];
        return commands.tokenize(message.text, commandDescription).then(function(parameters){
            var targets = parameters['targets'];
            var messageToSend = message.attachments[0].text;
            var channels = [];
            var users = [];
            _(targets).split('+').filter().forEach(function(t) {
                if (_.startsWith(t, '@')) {
                    users.push(chesster.users.getId(t.substr(1)));
                } else if (_.startsWith(t, '#')) {
                    channels.push(t);
                } else if (_.startsWith(t, '<@') && _.endsWith(t, '>')) {
                    var name = adminSlack.users.getByNameOrID(t.substr(2, t.length-3)).name;
                    users.push(chesster.users.getId(name));
                } else {
                    users.push(chesster.users.getId(t));
                }
            });
            var promises = [];
            var deferred = null;
            if (users.length === 1) {
                deferred = Q.defer();
                chesster.api.im.open(
                    {user: users[0]},
                    function(err, response) {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            if (!response.ok) {
                                deferred.reject(response);
                            } else {
                                chesster.say({
                                    channel: response.channel.id,
                                    text: messageToSend,
                                    attachments: []
                                });
                                deferred.resolve();
                            }
                        }
                    }
                );
                promises.push(deferred.promise);
            } else if (users.length > 1) {
                deferred = Q.defer();
                chesster.api.mpim.open(
                    {users: users.join(',')},
                    function(err, response) {
                        if (err) {
                            deferred.reject(err);
                        } else {
                            if (!response.ok) {
                                deferred.reject(response);
                            } else {
                                chesster.say({
                                    channel: response.group.id,
                                    text: messageToSend,
                                    attachments: []
                                });
                                deferred.resolve();
                            }
                        }
                    }
                );
                promises.push(deferred.promise);
            }
            _.forEach(channels, function(channel) {
                chesster.say({
                    channel: channel,
                    text: messageToSend,
                    attachments: []
                });
            });
            return Q.all(promises);
        }).then(function() {
            bot.api.reactions.add({ name: "heavy_check_mark", channel: message.channel, timestamp: message.ts });
        }).catch(function(error){
            if(error instanceof commands.TooFewTokensError ||
                error instanceof commands.InvalidChoiceError ||
                error instanceof commands.InvalidConstantError ||
                error instanceof commands.InvalidTypeValueError){
                winston.error("Internal Error: Invalid format for message forwarding: {}".format(
                    JSON.stringify(error)
                ));
            }else if(error instanceof commands.InvalidTokenDescriptionError ||
                    error instanceof commands.InvalidTypeError){
                winston.error("[AVAILABILITY] Internal Error: Your description is not valid: {}".format(
                    JSON.stringify(error)
                ));
            }else{
                //some unknown error, rethrow;
                throw error;
            }
        });
    };
}

function refreshLeague(chesster, adminSlack) {
    return function(bot, message) {
        if (!_.isEqual(message.channel, adminSlack.config.messageForwarding.channel)) {
            return;
        }
        var commandDescription = [
            "refresh",
            "{text:type}",
            "{text:league}"
        ];
        return commands.tokenize(message.text, commandDescription).then(function(parameters){
            var type = parameters['type'];
            var leagueName = parameters['league'];
            var _league = league.getLeague(bot, leagueName, chesster.config);
            
            if (!_league) {
                winston.error("No matching league: {}".format(leagueName));
                return;
            }

            if (type === "pairings") {
                _league.refreshCurrentRoundSchedules().then(function(pairings) {
                    winston.info("Found " + pairings.length + " pairings for " + _league.options.name + " (manual refresh)");
                    _league.emitter.emit('refreshPairings', _league);
                }).catch(function(error) {
                    winston.error("{}: Error refreshing pairings: {}".format(_league.options.name, JSON.stringify(error)));
                });
            }
        }).catch(function(error){
            winston.error("Error in league refresh command: {}".format(
                JSON.stringify(error)
            ));
        });
    };
}

module.exports.forwardMessage = forwardMessage;
module.exports.refreshLeague = refreshLeague;
