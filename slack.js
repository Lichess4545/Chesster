//------------------------------------------------------------------------------
// Bot / Slack related helpers
//------------------------------------------------------------------------------
var Botkit = require('botkit');
var Q = require("q");
var league = require("./league.js");

var users = {
    byName: {},
    byId: {},
    getId: function(name){
        return this.byName[name].id;
    },
    getIdString: function(name){
        return "<@"+this.getId(name)+">";
    },
    getByNameOrID: function(nameOrId) {
        return this.byId[nameOrId] || this.byName[nameOrId];
    }
};
var channels = {
    byName: {},
    byId: {},
    getId: function(name){
        return this.byName[name].id;
    },
    getIdString: function(name){
        return "<#"+this.getId(name)+">";
    }
};

function updateUser(bot){
    // @ https://api.slack.com/methods/users.list
    bot.api.users.list({}, function (err, response) {
        if (err) {
            throw new Error(err);
        }

        if (response.hasOwnProperty('members') && response.ok) {
            var byName = {};
            var byId = {};
            var total = response.members.length;
            for (var i = 0; i < total; i++) {
                var member = response.members[i];
                byName[member.name] = member;
                byId[member.id] = member
            }
            users.byName = byName;
            users.byId = byId;
        }
        console.log("info: got users");
    });
}

function updateChannels(bot){
    // @ https://api.slack.com/methods/channels.list
    bot.api.channels.list({}, function (err, response) {
        if (err) {
            throw new Error(err);
        }

        if (response.hasOwnProperty('channels') && response.ok) {
            var byName = {};
            var byId = {};
            var total = response.channels.length;
            for (var i = 0; i < total; i++) {
                var channel = response.channels[i];
                byName[channel.name] = channel;
                byId[channel.id] = channel;
            }
            channels.byName = byName;
            channels.byId = byId;
        }
        console.log("info: got channels");
    });

}



/* 
   updates the user list
   updates the channel lists
   then repeats in new thread
   
   if it encounters an error it will exit the process with exit code 1
*/
var count = 0;
function refresh(bot, delay, config) {
    return criticalPath(Q.fcall(function(){
        console.log("doing refresh " + count++);
        bot.rtm.ping();
        
        updateUser(bot);
        updateChannels(bot);
        var _45_45 = league.getLeague("45+45", config);
        _45_45.refresh();
        setTimeout(function(){ 
            refresh(bot, delay);
        }, delay);
    }));
}

//------------------------------------------------------------------------------
function criticalPath(promise){
    exceptionLogger(promise).catch(function(e) {
        console.log("An exception was caught in a critical code-path. I am going down.");
        process.exit(1);
    });
    return promise;
}

//------------------------------------------------------------------------------
// a promise and ensures that uncaught exceptions are logged.
function exceptionLogger(promise){
    var deferred = Q.defer();
    promise.catch(function(e) {
        var error_log = "An error occurred:" +
            "\nDatetime: " + new Date() +
            "\nError: " + JSON.stringify(e) +
            "\nStack: " + e.stack;
        console.error(error_log);
        deferred.reject(e);
    });
    return deferred.promise;
}

function botExceptionHandler(bot, message, promise){
    exceptionLogger(promise).catch(function(e){
        console.log("Message: " + JSON.stringify(message));
        bot.reply(message, "Something has gone terribly terribly wrong. Please forgive me.");
        
    });
    return promise;
}

//------------------------------------------------------------------------------
function localTime(datetime) {
    return datetime.utcOffset(this.tz_offset / 60);
}

//------------------------------------------------------------------------------
function hears(controller, patterns, message_types, callback) {
    controller.hears(patterns, message_types, function(bot, message) {
        return botExceptionHandler(bot, message, Q.fcall(function() {
            message.player = users.getByNameOrID(message.user);
            // This will occur if a new player uses a chesster command
            // within their first 2 minutes of having joined. :)
            // we can fix this by loooking for joins to #general and ensuring
            // our users dict is up to date.
            if (!message.player) {
                throw new Error("Couldn't find a valid user??");
            }
            message.player.localTime = localTime;
            return callback(bot, message);
        }));
    });
}

module.exports.hears = hears;
module.exports.users = users;
module.exports.refresh = refresh;
module.exports.channels = channels;

