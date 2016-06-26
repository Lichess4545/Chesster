//------------------------------------------------------------------------------
// A simple subscription system
//------------------------------------------------------------------------------

var Q = require("q");
var _ = require("underscore");
var format = require('string-format')
format.extend(String.prototype)

var league = require("./league.js");
var slack = require("./slack.js");
var player = require("./player.js");
var db = require("./models.js");

// The emitter we will use.
const EventEmitter = require('events');
function ChessLeagueEmitter() {};
ChessLeagueEmitter.prototype  = new EventEmitter();
const emitter = new ChessLeagueEmitter();


var events = [
    "a-game-starts",
    "a-game-is-scheduled",
    "a-game-is-over",
    "a-pairing-is-released"
];

//------------------------------------------------------------------------------
// Format the help response message
//------------------------------------------------------------------------------
function formatHelpResponse(config) {
    return Q.fcall(function() {
        var leagueNames = [];
        _.each(league.getAllLeagues(config), function(l) {
            leagueNames.push(l.options.name);
        });
        return "The subscription system supports the following commands: \n" +
            "`tell me when <event> in <league> for <target-user-or-team>`\n" +
            "Where `<event>` is one of:```" + events.join("\n") + "```" +
            "and `<target-user-or-team>` is the target user or team that you are " +
            "subscribing to. <league> is one of:```" + leagueNames.join("\n") +
            "```";
    });
}

//------------------------------------------------------------------------------
// tell them they chose an invalid league
//------------------------------------------------------------------------------
function formatInvalidLeagueResponse(config) {
    return Q.fcall(function() {
        var leagueNames = [];
        _.each(league.getAllLeagues(config), function(l) {
            leagueNames.push(l.options.name);
        });
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
        return "`" + source + "` is not a valid source of that event. Please target a valid user.";
    });
}

//------------------------------------------------------------------------------
// Processes a tell command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTellCommand(config, message) {
    return Q.fcall(function() {
        var requester = player.getSlackUserFromNameOrID(slack.users, message.user);
        var components = message.text.split(" ");
        var args = components.slice(0, 7);
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
        var l = league.getLeague(targetLeague, config);
        if (_.isUndefined(l)) {
            return formatInvalidLeagueResponse(config);
        }
        // TODO: this is hacky, but required at the moment. :(
        message.league = l;

        // TODO: Allow captains some amount of flexibility of who they can subscribe
        if (!_.isEqual(listener, "me") && !message.player.isModerator()) {
            console.log(message.player.isModerator());
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

        // Ensure the source is a valid user within slack
        // TODO: Allow teams as a source, not just users.
        var source = player.getSlackUserFromNameOrID(slack.users, sourceName);
        if (_.isUndefined(source)) {
            return formatInvalidSourceResponse(config, sourceName);
        }
        return db.lock().then(function(unlock) {
            return db.Subscription.findOrCreate({
                where: {
                    requester: requester.name.toLowerCase(),
                    source: source.name.toLowerCase(),
                    event: event.toLowerCase(),
                    league: l.options.name.toLowerCase(),
                    target: listener.toLowerCase()
                }
			}).then(function(subscription) {
                unlock.resolve();
                return "Great! I will tell {target} when {event} for {source} in {league}".format({
                    source: source.name,
                    event: event,
                    league: l.options.name,
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
function processSubscriptionsCommand(config, message) {
    return Q.fcall(function() {
        var requester = player.getSlackUserFromNameOrID(slack.users, message.user);
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
function processRemoveSubscriptionCommand(config, message, id) {
    return Q.fcall(function() {
        var requester = player.getSlackUserFromNameOrID(slack.users, message.user);
        // TODO: Once we enable WAL - we can remove this lock for this command
        return db.lock().then(function(unlock) {
            return db.Subscription.findAll({
                where: {
                    requester: requester.name.toLowerCase(),
                    id: id
                }
			}).then(function(subscriptions) {
                if (subscriptions.length == 0) {
                    unlock.resolve();
                    return "That is not a valid subscription id";
                } else if (subscriptions.length == 1) {
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


module.exports.emitter = emitter;
module.exports.processTellCommand = processTellCommand;
module.exports.processSubscriptionsCommand = processSubscriptionsCommand;
module.exports.processRemoveSubscriptionCommand = processRemoveSubscriptionCommand;
