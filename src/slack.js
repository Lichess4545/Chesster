//------------------------------------------------------------------------------
// Bot / Slack related helpers
//------------------------------------------------------------------------------
const Q = require("q");
const Botkit = require('botkit');
const _ = require("lodash");
const league = require("./league.js");
const fuzzy = require("./fuzzy_match.js");
const models = require("./models.js");
const winston = require('winston');
const logging = require('./logging.js');

var slackIDRegex = module.exports.slackIDRegex = /<@([^\s]+)>/;

function StopControllerError (error) { this.error = error; }
StopControllerError.prototype = new Error();

//
var MILISECOND = 1;
var SECONDS = 1000 * MILISECOND;

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
        return new RegExp(playerRegex + "?", "i");
    }

    return new RegExp(playerRegex, "i");
}

function getSlackUser(message) {
    var self = this;
    // The user is either a string or an id
    var nameOrId = message.user;

    if (message.match[1]) {
        nameOrId = message.match[1];
    }
    var player = getSlackUserFromNameOrID(nameOrId);

    if (!player) {
        player = self.users.getByNameOrID(message.user); 
    }

    return player;
}

function getSlackUserFromNameOrID(nameOrId) {
    var self = this;

    // The name or Id was provided, so parse it out
    var player = self.users.getByNameOrID(nameOrId);

    // If the player didn't exist that way, then it could be the @notation
    if (!player && nameOrId) {
        // Slack user ids are tranlated in messages to something like <@U17832>.  This
        // regex will capture the U17832 part so we can send it through the getByNameOrId
        // function
        var userIdExtraction = nameOrId.match(slackIDRegex);
        if (userIdExtraction) {
            player = self.users.getByNameOrID(userIdExtraction[1]);
        } else {
            player = self.users.getByNameOrID(nameOrId.toLowerCase());
        }
    }
    return player;
}

function updatesUsers(bot){
    var self = this;
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
                byId[member.id] = member;
            }
            self.users.byName = byName;
            self.users.byId = byId;
        }
        winston.info("info: got users");
    });
}

function updateChannels(bot){
    var self = this;
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
            self.channels.byName = byName;
            self.channels.byId = byId;
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
    var self = this;
    return criticalPath(Q.fcall(function(){
        winston.info("doing refresh " + count++);
        bot.rtm.ping();
        
        self.updatesUsers(bot);
        self.updateChannels(bot);
        if (self.options.refreshLeagues) {
            _.each(league.getAllLeagues(bot, config), function(l) {
                l.refresh();
            });
            setTimeout(function(){ 
                self.refresh(bot, delay, config);
            }, delay);
        }
    }));
}

function criticalPath(promise){
    exceptionLogger(promise).catch(function() {
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
    exceptionLogger(promise).catch(function(){
        winston.error("Message: " + JSON.stringify(message));
        bot.reply(message, "Something has gone terribly terribly wrong. Please forgive me.");
        
    });
    return promise;
}

function localTime(datetime) {
    return datetime.clone().tz(this.tz);
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
    };
}


//------------------------------------------------------------------------------
// Various middleware
//------------------------------------------------------------------------------
function requiresModerator(bot, message) {
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

function findLeagueByMessageText(bot, message, config) {
    var allLeagues = league.getAllLeagues(bot, config);
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
        matches.push.apply(matches, results);
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
        return _.values(possibleLeagues)[0];
    }
    return null;
}

function _withLeagueImplementation(bot, message, config, channelOnly) {
    return Q.fcall(function() {
        message.league = null;

        // See if the person asked for a specific league first

        // generate a set of possible target leagues
        var l;
        if (!channelOnly) {
            l = findLeagueByMessageText(bot, message, config);
            if (l) {
                message.league = l;
                return l;
            }
        }

        // If they didn't ask for a specific league, then we will use the channel
        // to determine it
        var targetLeague;
        var channel = bot.channels.byId[message.channel];
        if (channel && channel.name) {
            targetLeague = config.channel_map[channel.name];
            l = league.getLeague(bot, targetLeague, config);
            if (l) {
                message.league = l;
                return l;
            }
        }

        // If no channel name matched, try the channel Id this is necessary for private channels
        // it makes me sad ... :(
        var channelId = message.channel;
        targetLeague = config["channel_map"][channelId];
        if (targetLeague){
            l = league.getLeague(bot, targetLeague, config);
            if (l){
                message.league = l;
                return l;
            }
        }
        return;
    });
}
function withLeague(bot, message, config) {
    return _withLeagueImplementation(bot, message, config, false);
}
function withLeagueByChannelName(bot, message, config) {
    return _withLeagueImplementation(bot, message, config, true);
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
var DEFAULT_HEARS_OPTIONS = {
    middleware: []
};
function hears(options, callback) {
    var self = this;
    options = _.extend({}, DEFAULT_HEARS_OPTIONS, options);
    self.controller.hears(options.patterns, options.messageTypes, function(bot, message) {
        return botExceptionHandler(bot, message, Q.fcall(function() {
            message.player = self.users.getByNameOrID(message.user);
            // This will occur if a new player uses a chesster command
            // within their first 2 minutes of having joined. :)
            // we can fix this by loooking for joins to #general and ensuring
            // our users dict is up to date.
            if (message.player) {
                message.player.localTime = localTime;
                message.player.isModerator = isModerator(message);
            }
            return Q.all(
                _.map(options.middleware, function(middleware) {
                    return middleware(self, message, self.config);
                })
            ).then(function() {
                return callback(self, message);
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
var DEFAULT_ON_OPTIONS = {
    middleware: []
};
function on(options, callback) {
    var self = this;
    options = _.extend({}, DEFAULT_ON_OPTIONS, options);
    self.controller.on(options.event, function(bot, message) {
        return botExceptionHandler(bot, message, Q.fcall(function() {
            message.player = self.users.getByNameOrID(message.user);
            if (message.player) {
                message.player.localTime = localTime;
                message.player.isModerator = isModerator(message);
            }
            return Q.all(
                _.map(options.middleware, function(middleware) {
                    return middleware(self, message, self.config);
                })
            ).then(function() {
                return callback(self, message);
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
function say(options) {
    this.bot.say(options);
}
//------------------------------------------------------------------------------
// A helper method to workaround a bug in botkit. 
//
// We store a reference to 'bot' in the startRTM method and then use it here
// to start a new dm. This also turns it into a promised based API
//------------------------------------------------------------------------------
function startPrivateConversation(nameOrId) {
    var self = this;
    var deferred = Q.defer();
    var target = self.getSlackUserFromNameOrID(nameOrId);
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


var DEFAULT_BOT_OPTIONS = {
    slackName: "",
    debug: false,
    configFile: "./config/config.js",
    connectToModels: true,
    refreshLeagues: true,
    logToThisSlack: false
};

function Bot(options) {
    var self = this;
    self.options = _.extend({}, DEFAULT_BOT_OPTIONS, options);
    winston.info("Loading config from: " + self.options.configFile);
    self.config = require(self.options.configFile);

    self.token = self.config.slack_tokens[self.options.slackName];
    if (!self.token) {
        winston.error('Failed to load token from: ' + self.options.configFile);
        throw new Error("A token must be specified in the configuration file");
    }

    var bot_options = {
        debug: self.options.debug
    };
    self.users = {
        byName: {},
        byId: {},
        getId: function(name){
            return this.byName[_.toLower(name)].id;
        },
        getIdString: function(name){
            return "<@"+this.getId(name)+">";
        },
        getByNameOrID: function(nameOrId) {
            return this.byId[_.toUpper(nameOrId)] || this.byName[_.toLower(nameOrId)];
        }
    };
    self.channels = {
        byName: {},
        byId: {},
        getId: function(name){
            return this.byName[name].id;
        },
        getIdString: function(name){
            return "<#"+this.getId(name)+">";
        }
    };
    self.controller = Botkit.slackbot(bot_options);
    self.controller.spawn({
        token: self.token
    }).startRTM(function(err, bot) {
        // Store a reference to the bot so that we can use it later.
        self.bot = bot;

        // Make chesster and the bot a bit more interchangeable.
        self.reply = bot.reply;
        self.api = bot.api;

        if (err) {
            throw new Error(err);
        }
        // connect to the database
        if (self.options.connectToModels) {
            models.connect(self.config).then(function() {
                //refresh your user and channel list every 2 minutes
                //would be nice if this was push model, not poll but oh well.
                self.refresh(bot, 120 * SECONDS, self.config);
            });
        } else {
            self.refresh(bot, 120 * SECONDS, self.config);
        }
    });


    winston.level = 'silly';
    if (self.options.logToThisSlack) {
        // setup logging
        // Pass in a reference to ourselves.
        self.config.winston.controller = self;
        winston.add(logging.Slack, self.config.winston);
    }

    self.hears = hears;
    self.on = on;
    self.say = say;
    self.startPrivateConversation = startPrivateConversation;
    self.updatesUsers = updatesUsers;
    self.updateChannels = updateChannels;
    self.getSlackUser = getSlackUser;
    self.getSlackUserFromNameOrID = getSlackUserFromNameOrID;
    self.refresh = refresh;
}

module.exports.withLeague = withLeague;
module.exports.withLeagueByChannelName = withLeagueByChannelName;
module.exports.requiresModerator = requiresModerator;
module.exports.requiresLeague = requiresLeague;
module.exports.appendPlayerRegex = appendPlayerRegex;
module.exports.Bot = Bot;

