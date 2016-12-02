//------------------------------------------------------------------------------
// Commands related to game nomination
//------------------------------------------------------------------------------
const winston = require("winston");
const slack = require('../slack.js');
const heltour = require('../heltour.js');

function nomination(bot, message) {
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }

    var speaker = slack.users.getByNameOrID(message.user);
    heltour.getPrivateURL(
        heltourOptions,
        'nominate', //hardcoding this for now
        speaker.name
    ).then(function(jsonResult){
        bot.reply(message, "Use this link to nominate your choice: {}".format(jsonResult.url));
        bot.reply(message, "NOTE: this is a private link. Do not share it.");
        bot.reply(message, "This link will expire at: {}".format(jsonResult.expires));
    }).catch(function(error){
        winston.error("[NOMINATION] private link acquisition failure: {}".format(error));
        bot.reply(message, "I failed to get your private link. Please ask @endrawes0 for help.");
    });
}

exports.nomination = nomination;
