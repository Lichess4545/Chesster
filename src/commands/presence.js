//------------------------------------------------------------------------------
// Commands and helpers for detecting presence
//------------------------------------------------------------------------------
const _ = require("lodash");
const Q = require("q");

const heltour = require('../heltour.js');

function ambientPresence(config) {
    return function(bot, message) {
        var deferred = Q.defer();

        var mpim = bot.mpims.byId[message.channel];
        if (!mpim) {
            return;
        }
        var sender = message.user;
        var recips = _.without(mpim.members, bot.user_id, sender);
        if (recips.length !== 1) {
            deferred.resolve();
            return deferred.promise;
        }

        return heltour.playerContact(config.heltour, bot.users.getName(sender), bot.users.getName(recips[0]));
    };
}

module.exports.ambientPresence = ambientPresence;
