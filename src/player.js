var slackIDRegex = module.exports.slackIDRegex = /<@([^\s]+)>/;

module.exports.appendPlayerRegex = function(command, optional) {
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
};

module.exports.getSlackUser = function(users, message) {
    // The user is either a string or an id
    var nameOrId = message.user;

    if (message.match[1]) {
        nameOrId = message.match[1];
    }
    var player = getSlackUserFromNameOrID(users, nameOrId);

    if (!player) {
        player = users.getByNameOrID(message.user); 
    }

    return player;
};

var getSlackUserFromNameOrID = function(users, nameOrId) {

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
};
module.exports.getSlackUserFromNameOrID = getSlackUserFromNameOrID;
