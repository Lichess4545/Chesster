module.exports.appendPlayerRegex = function(command, optional) {
    var playerRegex = command + "(?: @?([^\\s]+))";

    if (optional) {
        return new RegExp(playerRegex + "?");
    }

    return new RegExp(playerRegex);
};

module.exports.getSlackUser = function(users, message) {
    // The user is either a string or an id
    var nameOrId = message.user;

    if (message.match[1]) {
        nameOrId = message.match[1];
    }

    // The name or Id was provided, so parse it out
    var player = users.getByNameOrID(nameOrId);

    // If the player didn't exist that way, then it could be the @notation
    if (!player && nameOrId) {
        var userIdExtraction = nameOrId.match(/<@([^\s]+)>/);
        if (userIdExtraction) {
            player = users.getByNameOrID(userIdExtraction[1]);
        } else {
            player = users.getByNameOrID(nameOrId.toLowerCase());
        }
    }

    if (!player) {
        player = users.getByNameOrID(message.user); 
    }

    return player;
};
