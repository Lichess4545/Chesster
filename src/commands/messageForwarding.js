const _ = require("lodash");
const Q = require("q");
const winston = require("winston");
const commands = require("../commands");

function forwardMessage(chesster, adminSlack) {
    return function(bot, message) {
        if (!_.isEqual(message.channel, adminSlack.config.messageForwarding.channel)) {
            return;
        }
        var commandDescription = [
            "forward",
            "to",
            "{text:targets}",
            "{text:message}"
        ];
        return commands.tokenize(message.text, commandDescription).then(function(parameters){
            var targets = parameters['targets'];
            var messageToSend = parameters['message'];
            var channels = [];
            var users = [];
            _(targets).split('+').filter().forEach(function(t) {
                if (_.startsWith(t, '@')) {
                    users.push(chesster.users.getId(t.substr(1)));
                } else if (_.startsWith(t, '#')) {
                    channels.push(chesster.channels.getId(t.substr(1)));
                } else if (_.startsWith(t, '<@') && _.endsWith(t, '>')) {
                    var name = adminSlack.users.getByNameOrID(t.substr(2, t.length-3)).name;
                    users.push(chesster.users.getId(name));
                } else {
                    users.push(chesster.users.getId(t));
                }
            });
            var promises = [];
            if (users.length === 1) {
                promises.push(
                    chesster.startPrivateConversation(users[0]).then(function(convo) {
                        convo.say(messageToSend);
                    })
                );
            } else {
                var deferred = Q.defer();
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
                                    text: messageToSend
                                });
                            }
                        }
                    }
                );
                promises.push(deferred.promise);
            }
            _.forEach(channels, function(channel) {
                chesster.say({
                    channel: channel,
                    text: messageToSend
                });
            });
            return Q.all(promises);

        }).catch(function(error){
            if(error instanceof commands.TooFewTokensError ||
                error instanceof commands.InvalidChoiceError ||
                error instanceof commands.InvalidConstantError ||
                error instanceof commands.InvalidTypeValueError){
                bot.reply("Sorry, that format is not valid");
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
module.exports.forwardMessage = forwardMessage;
