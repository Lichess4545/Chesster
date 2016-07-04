//------------------------------------------------------------------------------
// Bot / Slack related helpers
//------------------------------------------------------------------------------
var Q = require("q");
var Botkit = require('botkit');
var _ = require("lodash");
var league = require("./league.js");
var fuzzy = require("./fuzzy_match.js");
var models = require("./models.js");
var winston = require('winston');
var logging = require('./logging.js');

var slackIDRegex = module.exports.slackIDRegex = /<@([^\s]+)>/;

function StopControllerError (error) { this.error = error; }
StopControllerError.prototype = new Error();

//
var MILISECOND = 1;
var SECONDS = 1000 * MILISECOND;

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
function appendPlayerRegex(command, optional) {
    /*
     * regex explanation
     * (?:           non capturing group, don't care about the space and @ part
     * @?            @ is optional (accepts "@user" or "user")
     * ([^\\s]+)     match one more more non-whitespace characters and capture it.  This
     *               is what will show up in the match[1] place.
     * )
     */
    var playerRegex = command + "(?: @?([^\\s]+))";

    if (optional) {
        // If the username is optional (as in the "rating" command), append
        // a ? to the whole player matching regex.
        return new RegExp(playerRegex + "?");
    }

    return new RegExp(playerRegex);
}

function getSlackUser(message) {
    // The user is either a string or an id
    var nameOrId = message.user;

    if (message.match[1]) {
        nameOrId = message.match[1];
    }
    var player = getSlackUserFromNameOrID(nameOrId);

    if (!player) {
        player = users.getByNameOrID(message.user); 
    }

    return player;
}

function getSlackUserFromNameOrID(nameOrId) {

    // The name or Id was provided, so parse it out
    var player = users.getByNameOrID(nameOrId);

    // If the player didn't exist that way, then it could be the @notation
    if (!player && nameOrId) {
        // Slack user ids are tranlated in messages to something like <@U17832>.  This
        // regex will capture the U17832 part so we can send it through the getByNameOrId
        // function
        var userIdExtraction = nameOrId.match(slackIDRegex);
        if (userIdExtraction) {
            player = users.getByNameOrID(userIdExtraction[1]);
        } else {
            player = users.getByNameOrID(nameOrId.toLowerCase());
        }
    }
    return player;
}

function updatesUsers(bot){
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
        winston.info("info: got users");
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
        winston.info("info: got channels");
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
        winston.info("doing refresh " + count++);
        bot.rtm.ping();
        
        updatesUsers(bot);
        updateChannels(bot);
        _.each(league.getAllLeagues(config), function(l) {
            l.refresh();
        });
        setTimeout(function(){ 
            refresh(bot, delay, config);
        }, delay);
    }));
}

function criticalPath(promise){
    exceptionLogger(promise).catch(function(e) {
        winston.error("An exception was caught in a critical code-path. I am going down.");
        process.exit(1);
    });
    return promise;
}

// a promise and ensures that uncaught exceptions are logged.
function exceptionLogger(promise){
    var deferred = Q.defer();
    promise.catch(function(e) {
        var error_log = "An error occurred:" +
            "\nDatetime: " + new Date() +
            "\nError: " + JSON.stringify(e) +
            "\nStack: " + e.stack;
        winston.error(error_log);
        deferred.reject(e);
    });
    return deferred.promise;
}

function botExceptionHandler(bot, message, promise){
    exceptionLogger(promise).catch(function(e){
        winston.error("Message: " + JSON.stringify(message));
        bot.reply(message, "Something has gone terribly terribly wrong. Please forgive me.");
        
    });
    return promise;
}

function localTime(datetime) {
    return datetime.utcOffset(this.tz_offset / 60);
}

//------------------------------------------------------------------------------
// A helper to determine if the user is a moderator
//------------------------------------------------------------------------------
function isModerator(message) {
    return function() {
        if (!message.league) {
            throw new Error("isModerator requires a league to be attached to the message. Use the withLeague middleware");
        }
        return message.league.isModerator(this.name);
    }
}


//------------------------------------------------------------------------------
// Various middleware
//------------------------------------------------------------------------------
function requiresModerator(bot, message, config) {
    return Q.fcall(function() {
        if (_.isUndefined(message.league)) {
            throw new Error("requiresModerator MUST be called after withLeague.");
        }
        if (!message.league) {
            throw new Error("Not in a league context");
        }
        if (!message.player.isModerator()) {
            bot.reply(message, "You are not a moderator of the {name} league. Your temerity has been logged.".format({
                name: message.league.options.name
            }));
            throw new StopControllerError("Not a moderator.");
        }
    });
}

function withLeague(bot, message, config) {
    return Q.fcall(function() {
        message.league = null;

        // See if the person asked for a specific league first

        // generate a set of possible target leagues
        var allLeagues = league.getAllLeagues(config);
        var leagueTargets = [];
        var targetToLeague = {};
        function add_target(l, target) {
            leagueTargets.push(target);
            targetToLeague[target] = l;
        }
        _.each(allLeagues, function(l) {
            add_target(l, l.options.name);
            _.each(l.options.also_known_as, function(aka) {
                add_target(l, aka);
            });
        });

        // Now fuzzy match them based on each arg in the message
        var matches = [];
        var args = message.text.split(" ");
        _.each(args, function(arg) {
            var results = fuzzy.rank_choices(arg.toLowerCase(), leagueTargets, true);
            matches.push.apply(matches, results)
        });
        var bestMatches = fuzzy.findBestMatches(matches, true);
        var possibleLeagues = {};
        _.each(bestMatches, function(match) {
            var l = targetToLeague[match[1]];
            possibleLeagues[l.options.name] = l;
        });
        var matchingLeagueNames = _.keys(possibleLeagues);
        if (matchingLeagueNames.length > 1) {
            throw new StopControllerError("Ambiguous leagues.");
        }
        if (matchingLeagueNames.length === 1) {
            l = _.values(possibleLeagues)[0];
            message.league = l;
            return l;
        }

        // If they didn't ask for a specific league, then we will use the channel
        // to determine it
        var channel = channels.byId[message.channel];
        if (channel && channel.name) {
            var target_league = config.channel_map[channel.name];
            l = league.getLeague(target_league, config);
            if (l) {
                message.league = l;
                return l;
            }
        }
        return;
    });
}
function requiresLeague(bot, message, config) {
    return withLeague(bot, message, config).then(function(l) {
        if (!l || !message.league) {
            bot.reply(message, "This command requires you to specify the league you are interested in. Please include that next time");
            throw new StopControllerError("No league specified");
        }
    });
}


//------------------------------------------------------------------------------
// A controller wrapper.
//------------------------------------------------------------------------------
DEFAULT_HEARS_OPTIONS = {
    middleware: []
};
function hears(options, callback) {
    var self = this;
    options = _.extend({}, DEFAULT_HEARS_OPTIONS, options);
    self.controller.hears(options.patterns, options.messageTypes, function(bot, message) {
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
            message.player.isModerator = isModerator(message);
            return Q.all(
                _.map(options.middleware, function(middleware) {
                    return middleware(bot, message, self.config);
                })
            ).then(function() {
                return callback(bot, message);
            }, function(error) {
                if(error instanceof StopControllerError) {
                    winston.error("Middleware asked to not process controller callback: " + JSON.stringify(error));
                } else {
                    throw error;
                }
            });

        }));
    });
}
DEFAULT_ON_OPTIONS = {
    middleware: []
};
function on(options, callback) {
    var self = this;
    options = _.extend({}, DEFAULT_ON_OPTIONS, options);
    self.controller.on(options.event, function(bot, message) {
        return botExceptionHandler(bot, message, Q.fcall(function() {
            message.player = users.getByNameOrID(message.user);
            if (message.player) {
                message.player.localTime = localTime;
                message.player.isModerator = isModerator(message);
            }
            return Q.all(
                _.map(options.middleware, function(middleware) {
                    return middleware(bot, message, self.config);
                })
            ).then(function() {
                return callback(bot, message);
            }, function(error) {
                if(error instanceof StopControllerError) {
                    winston.error("Middleware asked to not process controller callback: " + JSON.stringify(error));
                } else {
                    throw error;
                }
            });

        }));
    });
}
//------------------------------------------------------------------------------
// A helper method to workaround a bug in botkit. 
//
// We store a reference to 'bot' in the startRTM method and then use it here
// to start a new dm. This also turns it into a promised based API
//------------------------------------------------------------------------------
function startPrivateConversation(nameOrId) {
    var deferred = Q.defer();
    target = getSlackUserFromNameOrID(nameOrId);
    if (_.isNil(target)) {
        deferred.reject("Unable to find user");
    } else {
        this.bot.startPrivateConversation({user: target.id}, function(err, convo) {
            if (err) {
                deferred.reject(err);
            }
            deferred.resolve(convo);
        });
    }
    return deferred.promise;
}


DEFAULT_BOT_OPTIONS = {
    debug: false,
    config_file: "./config.js"
};

function Bot(options) {
    var self = this;
    self.options = _.extend({}, DEFAULT_BOT_OPTIONS, options);
    winston.info("Loading config from: " + self.options.config_file);
    self.config = require(self.options.config_file);
    if (!self.config.token) {
        winston.error('Failed to load token from: ' + config_file);
        throw new Error("A token must be specified in the configuration file");
    }

    var bot_options = {
        debug: self.options.debug
    };
    self.controller = Botkit.slackbot(bot_options);
    self.controller.spawn({
      token: self.config.token
    }).startRTM(function(err, bot) {
        // Store a reference to the bot so that we can use it later.
        self.bot = bot;
        if (err) {
            throw new Error(err);
        }
        // connect to the database
        models.connect(self.config).then(function() {
            //winston.debug(bot === self);
            //refresh your user and channel list every 2 minutes
            //would be nice if this was push model, not poll but oh well.
            refresh(bot, 120 * SECONDS, self.config);
        });
    });


    // setup logging
    // Only log to slack if the token is set.
    if (self.config.winston.token) {
        winston.add(logging.Slack, self.config.winston);
    }

    self.hears = hears;
    self.on = on;
    self.startPrivateConversation = startPrivateConversation;
}

module.exports.users = users;
module.exports.channels = channels;
module.exports.withLeague = withLeague;
module.exports.requiresModerator = requiresModerator;
module.exports.requiresLeague = requiresLeague;
module.exports.appendPlayerRegex = appendPlayerRegex;
module.exports.getSlackUser = getSlackUser;
module.exports.getSlackUserFromNameOrID = getSlackUserFromNameOrID;
module.exports.Bot = Bot;

