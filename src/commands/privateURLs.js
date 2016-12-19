//------------------------------------------------------------------------------
// Commands related to game nomination
//------------------------------------------------------------------------------
const moment = require('moment-timezone');
const winston = require("winston");
const heltour = require('../heltour.js');

//------------------------------------------------------------------------------
function getPrivateURL(bot, message, name) {
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }

    var speaker = bot.users.getByNameOrID(message.user);
    return heltour.getPrivateURL(heltourOptions, name, speaker.name).catch(function(error){
        winston.error("[{}] private link acquisition failure: {}".format(name, error));
        bot.reply(message, "I failed to get your private link. Please notify a moderator.");
    });
}

//------------------------------------------------------------------------------
function privateExpiryWarning(bot, message, jsonResult) {
    var localTime = message.player.localTime(moment.utc(jsonResult.expires));
    bot.reply(message, "NOTE: this is a private link. Do not share it.");
    bot.reply(message, "This link will expire at: {} in your local time".format(localTime.format("MMM Do YY h:mm a")));
}

//------------------------------------------------------------------------------
function nomination(bot, message) {
    getPrivateURL(bot, message, 'nominate').then(function(jsonResult) {
        bot.reply(message, "Use this link to nominate your choice: {}".format(jsonResult.url));
        privateExpiryWarning(bot, message, jsonResult);
    });
}

//------------------------------------------------------------------------------
function notification(bot, message) {
    getPrivateURL(bot, message, 'notifications').then(function(jsonResult) {
        bot.reply(message, "Use this link to set your notifications preferences: {}".format(jsonResult.url));
        privateExpiryWarning(bot, message, jsonResult);
    });
}

exports.nomination = nomination;
exports.notification = notification;
