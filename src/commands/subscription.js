//------------------------------------------------------------------------------
// Commands and helpers related to subscriptions
//------------------------------------------------------------------------------
const Q = require("q");
const _ = require("lodash");
const format = require('string-format');
const winston = require('winston');
format.extend(String.prototype);

const league = require("../league.js");
const db = require("../models.js");

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
function formatHelpResponse(bot, config) {
    return Q.fcall(function() {
        var leagueNames = _.map(league.getAllLeagues(bot, config), "options.name");

        return "The subscription system supports the following commands: \n" +
            "1. `tell <listener> when <event> in <league> for <target-user-or-team>` to " +
            " subscribe to an event\n" +
            "2. `subscription list` to list your current subscriptions\n" +
            "3. `subscription remove <id>` to list remove a specific subscription\n" +
            "\n--------------------------------------------------------------------\n" +
            "For command 1, these are the options: \n" + 
            "1. `<listener>` is either `me` to subscribe yourself or " +
            " `my-team-channel` to subscribe your team channel (_Note: you must be " +
            " be team captain to use `my-team-channel`_).\n" +
            "2. `<event>` is one of:`" + events.join("` or `") + "`\n" +
            "3. `<league>` is one of: `" + leagueNames.join("` or `") + "`\n" +
            "4. `<target-user-or-team>` is the target username or teamname that you are " +
            "subscribing to (_Note: You can use `my-team` to target your team_).";
    });
}

//------------------------------------------------------------------------------
// tell them they chose an invalid league
//------------------------------------------------------------------------------
function formatInvalidLeagueResponse(bot, config) {
    return Q.fcall(function() {
        var leagueNames = _.map(league.getAllLeagues(bot, config), "options.name");

        return "You didn't specify a valid league. These are your options:\n" +
            "```" + leagueNames.join("\n") + "```";
    });
}

//------------------------------------------------------------------------------
// Tell them they can only listen for themselves
//------------------------------------------------------------------------------
function formatCanOnlyListenForYouResponse(config, listener) {
    return Q.fcall(function() {
        if (_.isEqual(listener, 'my-team-channel')) {
          return "You can't subscribe " + listener + " because you aren't the team captain." +
              " As a non-captain you can only subscribe yourself. Use 'me' as " + 
              " listener.";
        } else {
          return "You can't subscribe " + listener + " because you aren't a moderator." +
              " As a non-moderator you can only subscribe yourself. Use 'me' as " + 
              " listener.";
        }
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
// Format the response for when the user is not on a team
//------------------------------------------------------------------------------
function formatNoTeamResponse() {
    return Q.fcall(function() {
        return "You can't use my-team or my-team-channel since you don't have a team right now.";
    });
}

//------------------------------------------------------------------------------
// Format the a-game-is-scheduled response
//------------------------------------------------------------------------------
function formatAGameIsScheduled(bot, target, context) {
    // TODO: put these date formats somewhere, probably config?
    var friendlyFormat = "ddd @ HH:mm";
    target = bot.getSlackUserFromNameOrID(target);
    var message = "";
    if (target && target.tz_offset) {
        var targetDate = context.result.date.clone().utcOffset(target.tz_offset/60);
        context['yourDate'] = targetDate.format(friendlyFormat);
        message = "{white.name} vs {black.name} in {leagueName} has been scheduled for {realDate}, which is {yourDate} for you.";
    } else {
        message = "{white.name} vs {black.name} in {leagueName} has been scheduled for {realDate}.";
    }
    var fullFormat = "YYYY-MM-DD @ HH:mm UTC";
    context['realDate'] = context.result.date.format(fullFormat);
    return message.format(context);
}

//------------------------------------------------------------------------------
// Format the A Game Starts response.
//------------------------------------------------------------------------------
function formatAGameStarts(bot, target, context) {
    return "{white.name} vs {black.name} in {leagueName} has started: {result.gamelink}".format(context);
}

//------------------------------------------------------------------------------
// Format the a game is over response.
//------------------------------------------------------------------------------
function formatAGameIsOver(bot, target, context) {
    return "{white.name} vs {black.name} in {leagueName} is over. The result is {result.result}.".format(context);
}

//------------------------------------------------------------------------------
// Processes a tell command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTellCommand(bot, config, message) {
    return Q.fcall(function() {
        var requester = bot.getSlackUserFromNameOrID(message.user);
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
            return formatHelpResponse(bot, config).then(function(message) {
                return "I didn't understand you.\n" + message;
            });
        }

        // Ensure they chose a valid league.
        var _league = league.getLeague(bot, targetLeague, config);
        if (_.isUndefined(_league)) {
            return formatInvalidLeagueResponse(bot, config);
        }
        // TODO: this is hacky, but required at the moment. :(
        //       otherwise message.player.isModerator won't work.
        //       this is usually set by the requiresLeague middleware,
        //       but we are in a DM, not a league specific channel
        message.league = _league;
        var team = message.league.getTeamByPlayerName(message.player.name);
        var captainName = team && _(team.players).filter('isCaptain').map('username').value();
        var isCaptain = captainName && _.isEqual(_.toLower(captainName[0]), _.toLower(message.player.name));

        var possibleListeners = ['me', 'my-team-channel'];

        if (
            !(
                _.isEqual(listener, "me") ||
                message.player.isModerator() ||
                (_.isEqual(listener, "my-team-channel") && isCaptain)
            )
        ) {
            return formatCanOnlyListenForYouResponse(config, listener);
        }

        if (!_.includes(possibleListeners, listener)) {
            return formatInvalidListenerResponse(config, listener);
        }

        var target;
        if (_.isEqual(listener, "me")) {
            listener = 'you';
            target = requester.name;
        } else if (_.isEqual(listener, "my-team-channel")) {
            if (!team) {
                return formatNoTeamResponse();
            }
            listener = 'your team channel';
            target = "channel_id:" + team.slack_channel;
        }

        // Ensure the event is valid
        if (!_.includes(events, event)) {
            return formatInvalidEventResponse(config, event);
        }

        if (_.isEqual(sourceName,  'my-team')) {
            if (!team) {
                return formatNoTeamResponse();
            }
            sourceName = team.name;
        }
        // Ensure the source is a valid user or team within slack
        var source = bot.getSlackUserFromNameOrID(sourceName);
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
            return db.Subscription.findOrCreate({
                where: {
                    requester: requester.name.toLowerCase(),
                    source: sourceName.toLowerCase(),
                    event: event.toLowerCase(),
                    league: _league.options.name.toLowerCase(),
                    target: target.toLowerCase()
                }
            }).then(function() {
                return "Great! I will tell {target} when {event} for {source} in {league}".format({
                    source: sourceName,
                    event: event,
                    league: _league.options.name,
                    target: listener
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
function processSubscriptionListCommand(bot, config, message) {
    return Q.fcall(function() {
        var requester = bot.getSlackUserFromNameOrID(message.user);
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
                var context = subscription.get();
                if (_.startsWith(context['target'], 'channel_id:')) {
                    context['target'] = 'your team channel';
                }
                response += "\nID {id} -> tell {target} when {event} for {source} in {league}".format(context);
            });
            if (response.length === 0) {
                response = "You have no subscriptions";
            }

            return response;
        });
    });
}

//------------------------------------------------------------------------------
// Processes the remove subscription command
//
// subscriptions (by itself) simply lists your subscriptions with ID #s
//------------------------------------------------------------------------------
function processSubscriptionRemoveCommand(bot, config, message, id) {
    return Q.fcall(function() {
        var requester = bot.getSlackUserFromNameOrID(message.user);
        return db.Subscription.findAll({
            where: {
                requester: requester.name.toLowerCase(),
                id: id
            }
        }).then(function(subscriptions) {
            if (subscriptions.length === 0) {
                return "That is not a valid subscription id";
            } else if (subscriptions.length === 1) {
                return subscriptions[0].destroy().then(function() {
                    return "Subscription deleted";
                });
            } else {
                // This should never happen
                throw Error("This should never occur");
            }
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
        return getListeners(bot, league.options.name, sources, eventName).then(function(targets) {
            var allDeferreds = [];
            _.each(targets, function(target) {
                var deferred = Q.defer();
                var message = cb(bot, target, _.clone(context));
                if (_.startsWith(target, 'channel_id:')) {
                    var channelID = _.toUpper(target.substr(11));
                    bot.say({
                        channel: channelID,
                        text: message,
                        attachments: []
                    });
                } else {
                    bot.startPrivateConversation(target).then(function(convo) {
                        convo.say(message);
                        deferred.resolve();
                    }).catch(function(error) {
                        winston.error(JSON.stringify(error));
                    });
                }
                allDeferreds.push(deferred.promise);
            });
            return Q.all(allDeferreds);
        });
    });
}

//------------------------------------------------------------------------------
// Get listeners for a given event and source
//------------------------------------------------------------------------------
function getListeners(bot, leagueName, sources, event) {
    return  Q.fcall(function() {
        sources = _.map(sources, _.toLower);
        // These are names of users, not users. So we have to go get the real
        // user and teams. This is somewhat wasteful - but I'm not sure whether
        // this is the right design or if we should pass in users to this point. 
        var _league = league.getLeague(bot, leagueName);
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
            return _(subscriptions).map("target").uniq().value();
        });
    });
}

//------------------------------------------------------------------------------
// Format the not a moderator response
//------------------------------------------------------------------------------
function formatNotModerator() {
    return Q.fcall(function() {
        return "You are not a moderator and so you can't run this command";
    });
}

//------------------------------------------------------------------------------
// Process the subscribe teams command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTeamSubscribeCommand(bot, config, message) {
    return Q.fcall(function() {
        var _league = league.getLeague(bot, "45+45", config);
        // Needed for isModerator to work
        message.league = _league;
        if (!message.player.isModerator()) {
            return formatNotModerator();
        }
        return _league.getTeams().then(function(teams) {
            var processed = 0;
            var missing_channel = 0;
            var promises = [];
            _.forEach(teams, function(team) {
                if (!team.slack_channel) {
                    missing_channel++;
                } else {
                    var target = "channel_id:" + team.slack_channel;
                    processed++;
                    ["a-game-starts", "a-game-is-over"].forEach(function(event) {
                        return db.Subscription.findOrCreate({
                            where: {
                                requester: "chesster",
                                source: team.name.toLowerCase(),
                                event: event.toLowerCase(),
                                league: _league.options.name.toLowerCase(),
                                target: target.toLowerCase()
                            }
                        });
                    });
                }
            });
            return Q.all(promises).then(function() {
                return "Processed {processed} teams. {missing_channel} are missing channels.".format({
                    processed: processed,
                    missing_channel: missing_channel
                });
            });
        });
    });
}


//------------------------------------------------------------------------------
// Handler the tell me when command
//------------------------------------------------------------------------------
function tellMeWhenHandler(config) {
    return function(bot, message) {
        return bot.startPrivateConversation(message.user).then(function (convo) {
            return processTellCommand(bot, config, message).then(function(response) {
                convo.say(response);
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                winston.error(JSON.stringify(error));
            });
        });
    };
}

//------------------------------------------------------------------------------
// Handle the help message command
//------------------------------------------------------------------------------
function helpHandler(config) {
    return function(bot, message) {
        return bot.startPrivateConversation(message.user).then(function (convo) {
            return formatHelpResponse(bot, config).then(function(response) {
                convo.say(response);
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                winston.error(JSON.stringify(error));
            });
        });
    };
}

//------------------------------------------------------------------------------
// Handle the subscription list command.
//------------------------------------------------------------------------------
function listHandler(config) {
    return function(bot, message) {
        return bot.startPrivateConversation(message.user).then(function (convo) {
            return processSubscriptionListCommand(bot, config, message).then(function(response) {
                convo.say(response);
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                winston.error(JSON.stringify(error));
            });
        });
    };
}

//------------------------------------------------------------------------------
// Handle the subscription remove command.
//------------------------------------------------------------------------------
function removeHandler(config) {
    return function(bot, message) {
        return bot.startPrivateConversation(message.user).then(function (convo) {
            return processSubscriptionRemoveCommand(bot, config, message, message.match[1]).then(function(response) {
                convo.say(response);
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                winston.error(JSON.stringify(error));
            });
        });
    };
}

//------------------------------------------------------------------------------
// Handle the subscribe teams command
//------------------------------------------------------------------------------
function subscribeTeams(config) {
    return function(bot, message) {
        return bot.startPrivateConversation(message.user).then(function (convo) {
            return processTeamSubscribeCommand(bot, config, message).then(function(response) {
                convo.say(response);
            }).catch(function(error) {
                convo.say("I'm sorry, but an error occurred processing this subscription command");
                winston.error(JSON.stringify(error));
            });
        });
    };
}

module.exports.emitter = emitter;
module.exports.getListeners = getListeners;
module.exports.register = register;

module.exports.tellMeWhenHandler = tellMeWhenHandler;
module.exports.helpHandler = helpHandler;
module.exports.listHandler = listHandler;
module.exports.removeHandler = removeHandler;
module.exports.subscribeTeams = subscribeTeams;
module.exports.formatAGameIsScheduled = formatAGameIsScheduled;
module.exports.formatAGameStarts = formatAGameStarts;
module.exports.formatAGameIsOver = formatAGameIsOver;
