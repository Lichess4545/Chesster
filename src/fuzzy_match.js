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

module.exports.rank_choices = rank_choices;
module.exports.findBestMatches = findBestMatches;
