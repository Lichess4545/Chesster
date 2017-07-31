//------------------------------------------------------------------------------
// Commands and helpers for detecting presence
//------------------------------------------------------------------------------
const _ = require("lodash");
const winston = require("winston");
const Q = require("q");

const heltour = require('../heltour.js');
const league = require('../league.js');

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
        
        var leagues = league.getAllLeagues(bot, config);
        // TODO: This is potentially fragile.
        var heltourOptions = leagues[0].options.heltour;
        if (!heltourOptions) {
            winston.error("[PRESENCE] {} league doesn't have heltour options!?".format(leagues[0].options.name));
            deferred.resolve();
            return deferred.promise;
        } 

        return heltour.playerContact(heltourOptions, bot.users.getName(sender), bot.users.getName(recips[0]));
    };
}

module.exports.ambientPresence = ambientPresence;
