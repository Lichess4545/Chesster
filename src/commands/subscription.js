//------------------------------------------------------------------------------
// Commands related to subscriptions
//------------------------------------------------------------------------------

var Q = require("q");
var _ = require("lodash");
var format = require('string-format');
format.extend(String.prototype);

var league = require("../league.js");
var slack = require("../slack.js");
var db = require("../models.js");

// The emitter we will use.
const EventEmitter = require('events');
function ChessLeagueEmitter() {}
ChessLeagueEmitter.prototype  = new EventEmitter();
const emitter = new ChessLeagueEmitter();


var events = [
    //"a-game-starts",
    //"a-game-is-scheduled",
    //"a-game-is-over",
    //"a-pairing-is-released"
];

//------------------------------------------------------------------------------
// Format the help response message
//------------------------------------------------------------------------------
function formatHelpResponse(config) {
    return Q.fcall(function() {
        var leagueNames = _.map(league.getAllLeagues(config), "options.name");

        return "The subscription system supports the following commands: \n" +
            "`tell me when <event> in <league> for <target-user-or-team>`\n" +
            "Where `<event>` is one of:```" + events.join("\n") + "```" +
            " and `<target-user-or-team>` is the target user or team that you are " +
            "subscribing to.\n" +
            "`<league>` is one of:```" + leagueNames.join("\n") + "``` " +
            "\n" +
            "`subscription list` to list your current subscriptions\n" +
            "\n" +
            "`subscription remove <id>` to list remove a specific subscription\n" +
            "\n";
    });
}

//------------------------------------------------------------------------------
// tell them they chose an invalid league
//------------------------------------------------------------------------------
function formatInvalidLeagueResponse(config) {
    return Q.fcall(function() {
        var leagueNames = _.map(league.getAllLeagues(config), "options.name");

        return "You didn't specify a valid league. These are your options:\n" +
            "```" + leagueNames.join("\n") + "```";
    });
}

//------------------------------------------------------------------------------
// Tell them they can only listen for themselves
//------------------------------------------------------------------------------
function formatCanOnlyListenForYouResponse(config, listener) {
    return Q.fcall(function() {
        return "You can't subscribe " + listener + " because you aren't a moderator." +
            " As a non-moderator you can only subscribe yourself. Use 'me' as " + 
            " listener.";
    });
}

//------------------------------------------------------------------------------
// This is not a listener that we recognize
//------------------------------------------------------------------------------
function formatInvalidListenerResponse(config, listener) {
    return Q.fcall(function() {
        return "I don't recognize '" + listener + "'. Please use 'me' as the listener.";
    });
}

//------------------------------------------------------------------------------
// Format the invalid event handler
//------------------------------------------------------------------------------
function formatInvalidEventResponse(config, event) {
    return Q.fcall(function() {
        return "`" + event + "` is not one of the events that I recognize. Use one of: " +
            "```" + events.join("\n") + "```";
    });
}

//------------------------------------------------------------------------------
// Format the response for when the source is not valid
//------------------------------------------------------------------------------
function formatInvalidSourceResponse(config, source) {
    return Q.fcall(function() {
        return "`" + source + "` is not a valid source of that event. Please target a valid user or team.";
    });
}

//------------------------------------------------------------------------------
// Format the a-game-is-scheduled response
//------------------------------------------------------------------------------
function formatAGameIsScheduled(target, context) {
    // TODO: put these date formats somewhere, probably config?
    var friendlyFormat = "ddd @ HH:mm";
    target = slack.getSlackUserFromNameOrID(target);
    var targetDate = context.result.date.clone().utcOffset(target.tz_offset/60);
    context['yourDate'] = targetDate.format(friendlyFormat);
    var fullFormat = "YYYY-MM-DD @ HH:mm UTC";
    context['realDate'] = context.result.date.format(fullFormat);
    return "{white.name} vs {black.name} in {leagueName} has been scheduled for {realDate}, which is {yourDate} for you.".format(context);
}

//------------------------------------------------------------------------------
// Format the A Game Starts response.
//------------------------------------------------------------------------------
function formatAGameStarts(target, context) {
    return "{white.name} vs {black.name} in {leagueName} has started: {result.gamelink}".format(context);
}

//------------------------------------------------------------------------------
// Format the a game is over response.
//------------------------------------------------------------------------------
function formatAGameIsOver(target, context) {
    return "{white.name} vs {black.name} in {leagueName} is over. The result is {result.result}.".format(context);
}

//------------------------------------------------------------------------------
// Processes a tell command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTellCommand(config, message) {
    return Q.fcall(function() {
        var requester = slack.getSlackUserFromNameOrID(message.user);
        var components = message.text.split(" ");
        var args = _.map(components.slice(0, 7), _.toLower);
        var sourceName = components.splice(7).join(" ");
        var tell = args[0],
            listener = args[1],
            when = args[2],
            event = args[3],
            _in = args[4], 
            targetLeague = args[5], 
            _for = args[6];

        // Ensure the basic command format is valid
        if (!_.isEqual(["tell", "when", "in", "for"], [tell, when, _in, _for])) {
            return formatHelpResponse(config).then(function(message) {
                return "I didn't understand you.\n" + message;
            });
        }

        // Ensure they chose a valid league.
        var _league = league.getLeague(targetLeague, config);
        if (_.isUndefined(_league)) {
            return formatInvalidLeagueResponse(config);
        }
        // TODO: this is hacky, but required at the moment. :(
        //       otherwise message.player.isModerator won't work.
        //       this is usually set by the requiresLeague middleware,
        //       but we are in a DM, not a league specific channel
        message.league = _league;

        // TODO: Allow captains some amount of flexibility of who they can subscribe
        if (!_.isEqual(listener, "me") && !message.player.isModerator()) {
            return formatCanOnlyListenForYouResponse(config, listener);
        }

        // TODO: Allow more than just 'me' as a listener. For example:
        //       - captains can subscribe a private channel of less than 10 people 
        //         so long as they are a part of that channel themselves.
        //       - moderators should be able to do the same.
        if (!_.isEqual(listener, "me")) {
            return formatInvalidListenerResponse(config, listener);
        }

        if (_.isEqual(listener, "me")) {
            listener = requester.name;
        }

        // Ensure the event is valid
        if (!_.includes(events, event)) {
            return formatInvalidEventResponse(config, event);
        }

        // Ensure the source is a valid user or team within slack
        var source = slack.getSlackUserFromNameOrID(sourceName);
        return _league.getTeams().then(function(teams) {
            var team = _.find(teams, function(team) { return team.name.toLowerCase() === sourceName.toLowerCase();});
            if (_.isUndefined(source) && _.isUndefined(team)) {
                return formatInvalidSourceResponse(config, sourceName);
            }
            if (!_.isUndefined(source)) {
                sourceName = source.name;
            } else if (!_.isUndefined(team)) {
                sourceName = team.name;
            }
            return db.lock().then(function(unlock) {
                return db.Subscription.findOrCreate({
                    where: {
                        requester: requester.name.toLowerCase(),
                        source: sourceName.toLowerCase(),
                        event: event.toLowerCase(),
                        league: _league.options.name.toLowerCase(),
                        target: listener.toLowerCase()
                    }
                }).then(function() {
                    unlock.resolve();
                    return "Great! I will tell {target} when {event} for {source} in {league}".format({
                        source: sourceName,
                        event: event,
                        league: _league.options.name,
                        target: listener
                    });
                });
            });
        });
    });
}

//------------------------------------------------------------------------------
// Processes the subscriptions command
//
// subscriptions (by itself) simply lists your subscriptions with ID #s
//------------------------------------------------------------------------------
function processSubscriptionListCommand(config, message) {
    return Q.fcall(function() {
        var requester = slack.getSlackUserFromNameOrID(message.user);
        // TODO: Once we enable WAL - we can remove this lock for this command
        return db.lock().then(function(unlock) {
            return db.Subscription.findAll({
                where: {
                    requester: requester.name.toLowerCase()
                },
                order: [
                    ['id', 'ASC']
                ]
			}).then(function(subscriptions) {
                var response = "";
                _.each(subscriptions, function(subscription) {
                    response += "\nID {id} -> tell {target} when {event} for {source} in {league}".format(subscription.get());
                });
                if (response.length === 0) {
                    response = "You have no subscriptions";
                }

                unlock.resolve();
                return response;
            });
        });
    });
}

//------------------------------------------------------------------------------
// Processes the remove subscription command
//
// subscriptions (by itself) simply lists your subscriptions with ID #s
//------------------------------------------------------------------------------
function processSubscriptionRemoveCommand(config, message, id) {
    return Q.fcall(function() {
        var requester = slack.getSlackUserFromNameOrID(message.user);
        return db.lock().then(function(unlock) {
            return db.Subscription.findAll({
                where: {
                    requester: requester.name.toLowerCase(),
                    id: id
                }
			}).then(function(subscriptions) {
                if (subscriptions.length === 0) {
                    unlock.resolve();
                    return "That is not a valid subscription id";
                } else if (subscriptions.length === 1) {
                    return subscriptions[0].destroy().then(function() {
                        unlock.resolve();
                        return "Subscription deleted";
                    });
                } else {
                    // This should never happen
                    unlock.resolve();
                    throw Error("This should never occur");
                }
            });
        });
    });
}

//------------------------------------------------------------------------------
// Register an event + message handler
//------------------------------------------------------------------------------
function register(bot, eventName, cb) {
    // Ensure this is a known event.
    events.push(eventName);
    
    // Handle the event when it happens
    emitter.on(eventName, function(league, sources, context) {
        return getListeners(league.options.name, sources, eventName).then(function(targets) {
            var allDeferreds = [];
            _.each(targets, function(target) {
                var deferred = Q.defer();
                bot.startPrivateConversation(target).then(function(convo) {
                    var message = cb(target, _.clone(context));
                    convo.say(message);
                    deferred.resolve();
                });
                allDeferreds.push(deferred.promise);
            });
            return Q.all(allDeferreds);
        });
    });
}

//------------------------------------------------------------------------------
// Get listeners for a given event and source
//------------------------------------------------------------------------------
function getListeners(leagueName, sources, event) {
    sources = _.map(sources, _.toLower);
    // TODO: when we get WAL enabled, we won't need to lock this query any more.
    return db.lock().then(function(unlock) {
        // These are names of users, not users. So we have to go get the real
        // user and teams. This is somewhat wasteful - but I'm not sure whether
        // this is the right design or if we should pass in users to this point. 
        var _league = league.getLeague(leagueName);
        var teamNames = _(sources).map(function(n) { return _league.getTeamByPlayerName(n); }).filter(_.isObject).map("name").map(_.toLower).value();
        var possibleSources = _.concat(sources, teamNames);
        return db.Subscription.findAll({
            where: {
                league: leagueName.toLowerCase(),
                source: {
                    $in: possibleSources
                },
                event: event.toLowerCase()
            }
        }).then(function(subscriptions) {
            unlock.resolve();
            return _(subscriptions).map("target").uniq().value();
        });
    });
}


//------------------------------------------------------------------------------
// Handler the tell me when command
//------------------------------------------------------------------------------
function tellMeWhenHandler(config) {
    return function(bot, message) {
        var deferred = Q.defer();
        bot.startPrivateConversation(message, function (response, convo) {
            processTellCommand(config, message).then(function(response) {
                convo.say(response);
                deferred.resolve();
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                deferred.reject(error);
            });
        });
        return deferred.promise;
    };
}

//------------------------------------------------------------------------------
// Handle the help message command
//------------------------------------------------------------------------------
function helpHandler(config) {
    return function(bot, message) {
        var deferred = Q.defer();
        bot.startPrivateConversation(message, function (response, convo) {
            formatHelpResponse(config).then(function(response) {
                convo.say(response);
                deferred.resolve();
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                deferred.reject(error);
            });
        });
        return deferred.promise;
    };
}

//------------------------------------------------------------------------------
// Handle the subscription list command.
//------------------------------------------------------------------------------
function listHandler(config) {
    return function(bot, message) {
        var deferred = Q.defer();
        bot.startPrivateConversation(message, function (response, convo) {
            processSubscriptionListCommand(config, message).then(function(response) {
                convo.say(response);
                deferred.resolve();
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                deferred.reject(error);
            });
        });
        return deferred.promise;
    };
}

//------------------------------------------------------------------------------
// Handle the subscription remove command.
//------------------------------------------------------------------------------
function removeHandler(config) {
    return function(bot, message) {
        var deferred = Q.defer();
        bot.startPrivateConversation(message, function (response, convo) {
            processSubscriptionRemoveCommand(config, message, message.match[1]).then(function(response) {
                convo.say(response);
                deferred.resolve();
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                deferred.reject(error);
            });
        });
        return deferred.promise;
    };
}

module.exports.emitter = emitter;
module.exports.getListeners = getListeners;
module.exports.register = register;

module.exports.tellMeWhenHandler = tellMeWhenHandler;
module.exports.helpHandler = helpHandler;
module.exports.listHandler = listHandler;
module.exports.removeHandler = removeHandler;
module.exports.formatAGameIsScheduled = formatAGameIsScheduled;
module.exports.formatAGameStarts = formatAGameStarts;
module.exports.formatAGameIsOver = formatAGameIsOver;
