var levenshtein = require('fast-levenshtein');

var LONEWOLF_CHANNEL_NAMES = [
    "lonewolf-general",
    "lonewolf-gamelinks",
    "lonewolf-schedule",
    "lonewolf-results",
    "unstable_bot-lonewolf"
];
var TEAM_CHANNEL_NAMES = [
    "general",
    "team-general",
    "team-gamelinks",
    "team-schedule",
    "team-results",
    "unstable_bot"
];
var LONEWOLF_TARGETS = LONEWOLF_CHANNEL_NAMES.concat([
    "lonewolf",
    "lone",
    "wolf",
    "lw",
    "30",
    "3030",
]);
var TEAM_TARGETS = TEAM_CHANNEL_NAMES.concat([
    "team",
    "45",
    "4545",
]);

function findBestMatches(results, includeDistance) {
    if (results.length == 0) {
        return results;
    }
    results.sort(function(a,b) {
        return a[0] - b[0];
    });
    var choices = [];
    var min_distance = results[0][0];
    results.forEach(function(item) {
        var distance = item[0];
        var match = item[1];
        if (distance == min_distance) {
            if (includeDistance) {
                choices.push(item);
            } else {
                choices.push(match);
            }
        }
    });

    return choices;
}

function rank_choices(searchString, targets, includeDistance) {
    if (!targets) {
        throw new Error("rank_choices: No targets provided");
    }
    var results = [];
    targets.forEach(function(item) {
        var distance = levenshtein.get(searchString, item);

        // You have to get it at least half right
        if (distance < searchString.length/2) {
            results.push([distance, item]);
        }
    });
    return findBestMatches(results, includeDistance);
}

// TODO: I don't believe this is used anymore, if so rip it out
function match(message, commands, channels, arg_string) {
    var command = commands[0];
    var target = "general";
    var channel = channels[message.channel];
    if (channel && channel.name) {
        target = channel.name;
    }
    var args = arg_string;
    if (args) {
        args = args.split(" ");
        if (args.length > 2) {
            throw new Error("too many arguments to determine target / or command: ", arg_string);
        }
        args.forEach(function(item) {
            var found = false;
            commands.forEach(function(c) {
                if (found) { return; }
                if (levenshtein.get(c, item) < c.length / 2) {
                    found = true;
                    command = item;
                }
            });
            if (!found) {
                target = item;
            }
        });
    }
    command = rank_choices(command, commands);
    target = rank_choices(target, LONEWOLF_TARGETS.concat(TEAM_TARGETS));
    if (command.length > 1) {
        console.error("Ambiguous command: ", command, target);
        return {
            command: null,
            target: null
        };
    }
    command = command[0];
    var team_votes = 0;
    var wolf_votes = 0;
    target.forEach(function(item) {
        var is_team = TEAM_TARGETS.indexOf(item) > -1;
        var is_lonewolf = LONEWOLF_TARGETS.indexOf(item) > -1;
        if (is_team) team_votes++;
        if (is_lonewolf) wolf_votes++;
    });
    var retval = {
        command: command,
        target: null,
    };
    if (team_votes == wolf_votes) {
        console.error("Ambiguous target!");
    } else if (team_votes > wolf_votes) {
        retval.target = "team";
    } else if (wolf_votes > team_votes) {
        retval.target = "lonewolf";
    }
    return retval;
}

module.exports.match = match;
module.exports.rank_choices = rank_choices;
module.exports.findBestMatches = findBestMatches;
