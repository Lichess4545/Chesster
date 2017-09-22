//------------------------------------------------------------------------------
// Commands related to game nomination
//------------------------------------------------------------------------------
const moment = require('moment-timezone');
const winston = require("winston");
const heltour = require('../heltour.js');

//------------------------------------------------------------------------------
function nomination(bot, message) {
    bot.reply(message, "Use this link to nominate your choice: {}".format(message.league.options.links.nominate));
}

//------------------------------------------------------------------------------
function notification(bot, message) {
    bot.reply(message, "Use this link to set your notifications preferences: {}".format(message.league.options.links.notifications));
}

//------------------------------------------------------------------------------
function availability(bot, message) {
    bot.reply(message, "Use this link to set your availability: {}".format(message.league.options.links.availability));
}

exports.nomination = nomination;
exports.notification = notification;
exports.availability = availability;
