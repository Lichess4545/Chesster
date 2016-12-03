//------------------------------------------------------------------------------
// Commands related to league information
//------------------------------------------------------------------------------
const _ = require("lodash");
const winston = require("winston");
const Q = require("q");

const slack = require('../slack.js');
const league = require('../league.js');
const heltour = require('../heltour.js');
const subscription = require('../subscription.js');

// A helper for a very common pattern
function directResponse(responseName) {
    return function(bot, message) {
        return message.league[responseName]().then(function(response) {
            bot.reply(message, response);
        });
    };
}
// A helper for a very common pattern
function dmResponse(responseName) {
    return function (bot, message) {
        var deferred = Q.defer();
        bot.startPrivateConversation(message, function (response, convo) {
            message.league[responseName]().then(function(response) {
                convo.say(response);
                deferred.resolve();
            }, function(error) {
                deferred.reject(error);
            });
        });
        return deferred.promise;
    };
}


module.exports.directResponse = directResponse;
module.exports.dmResponse = dmResponse;
