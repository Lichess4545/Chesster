//------------------------------------------------------------------------------
// A simple subscription system
//------------------------------------------------------------------------------

var Q = require("q");
var _ = require("underscore");

var league = require("./league.js");

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
// Processes a tell command.
//
// A tell command is made up like so:
//      tell <listener> when <event> in <league> for <source>
//------------------------------------------------------------------------------
function processTellCommand(config, text) {
    return Q.fcall(function() {
        var components = text.split(" ");
        var args = components.slice(0, 7);
        var source = components.splice(7).join(" ");
        var tell = args[0],
            listener = args[1],
            when = args[2],
            event = args[3],
            _in = args[4], 
            targetLeague = args[5], 
            _for = args[6];
        if (!_.isEqual(["tell", "when", "in", "for"], [tell, when, _in, _for])) {
            return formatHelpResponse(config).then(function(message) {
                return "I didn't understand you.\n" + message;
            });
        }
        return "Args: [" + args + "] Source: [" + source + "]";
    });
}


module.exports.emitter = emitter;
module.exports.processTellCommand = processTellCommand;
