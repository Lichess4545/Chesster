//------------------------------------------------------------------------------
// Commands related to availability
//------------------------------------------------------------------------------
const winston = require("winston");
const _ = require("lodash");
const format = require('string-format');
format.extend(String.prototype);

const slack = require('../slack.js');
const commands = require('../commands.js');
const heltour = require('../heltour.js');

const utils = require('./utils.js');

function replyFailedToUpdate(bot, message, task, error){
    bot.reply(message, "I failed to update {}: {}".format(task, error));
    bot.reply(message, "Please contact a moderator.");
}

function replyOnlyACaptainOrAModeratorCanDoThat(bot, message){
    bot.reply(message, "Only the team's captain or a league moderator can do that.");
}

function replyThatsNotYourTeamName(bot, message, speakerTeam, teamName){
    bot.reply(message, "{} does not match your team name: {}".format(teamName, speakerTeam.name));
}

function formatReply(bot, message, reply, format){
    bot.reply(message, reply.format(format));
}

function formatReplyUpdatedAvailability(bot, message, playerName, available, roundNumber){
    formatReply(bot, message, 
        "I have updated the availability. " 
        + "*@{playerName} will{not}* be available for *round{roundNumber}*.",
        { 
            "playerName": playerName,
            "not": (available ? "" : " not"),
            "roundNumber": " " + roundNumber
        }
    );
}

function replyUnrecognizedTeam(bot, message, team){
    bot.reply(message, "I do not recognize the team: " + team);
}

function replyMisunderstood(bot, message, command, syntax){
    bot.reply(message, "Sorry, I did not understand your {}.".format(command));
    bot.reply(message, "Please use the following syntax:");
    bot.reply(message, "`{}`".format(syntax));
}

function replyMisunderstoodAvailability(bot, message){
    replyMisunderstood(bot, message, 
        "availability", 
        "[player <player> is] {available,unavailable} during round <round-number> in <league>");
}

function replyMisunderstoodAlternateAssignment(bot, message){
    replyMisunderstood(bot, message, 
        "alternate assignment",
        "assign <player> to board <board-number> during round <round-number> on <team-name>");
}

function replyMisunderstoodAlternateUnassignment(bot, message){
    replyMisunderstood(bot, message,
        "alternate unassignment",
        "unassign alternate for board <board-number> during round <round-number> on <team-name>");
}



/* [player <player-name> is] {available, unavailable} for round <round-number> in <league> */
function updateAvailability(bot, message) {
    var heltourOptions = message.league.options.heltour;
    if(!heltourOptions){
        winston.error("{} league doesn't have heltour options.".format(message.league.options.name));
        return;
    }

    var commandDescription;
    if(_.isEqual(_(message.text).split(' ').head(), "player")){
        commandDescription = [
            "player",
            "{text:playerName}",
            "is",
            "{available|unavailable}",
            "for",
            "round",
            "{int:roundNumber}",
            "in",
            "{text:league}"
        ];
    }else{
        commandDescription = [
            "{available|unavailable}",
            "for",
            "round",
            "{int:roundNumber}",
            "in",
            "{text:league}"
        ];
    }

    return commands.tokenize(message.text, commandDescription).then(function(parameters){
        var available = parameters["available"] ? true : false;
        var roundNumber = parameters["roundNumber"];
        var speaker = slack.getSlackUserFromNameOrID(message.user);
        var playerName = speaker.name;
        if(parameters["playerName"]){
            //playerName is specified as an identifier or clear text, validate it and get the name
            var slackUser = slack.getSlackUserFromNameOrID(parameters["playerName"]);
            if(!slackUser){
                //didnt find a user by Name or ID
               replyFailedToUpdate(bot, message, 
                    "availability", 
                    "unknown player: {}".format(parameters["playerName"])
                );
                return;
            }
            //get the team associated with the player
            playerName = slackUser.name;
            var playerTeam = message.league.getTeamByPlayerName(playerName);
            //get the team associated with the speaker
            var speakerTeam = message.league.getTeamByPlayerName(speaker.name);
            //the speaker must be the captain of the player's team or a moderator
            if (!utils.isCaptainOrModerator(speaker, speakerTeam, playerTeam, message.league)) {
                replyOnlyACaptainOrAModeratorCanDoThat(bot, message);
                return;
            }
        }

        return heltour.setAvailability(heltourOptions, playerName, available, roundNumber).then(function (){
            formatReplyUpdatedAvailability(bot, message, playerName, available, roundNumber);
        }).catch(function(error){
            replyFailedToUpdate(bot, message, "availability", error); 
        });
    }).catch(function(error){
        if(error instanceof commands.TooFewTokensError ||
            error instanceof commands.InvalidChoiceError ||
            error instanceof commands.InvalidConstantError ||
            error instanceof commands.InvalidTypeValueError){
            winston.debug("[AVAILABILITY] Couldn't understand {}".format(JSON.stringify(error)));
            replyMisunderstoodAvailability(bot, message);
        }else if(error instanceof commands.InvalidTokenDescriptionError ||
                error instanceof commands.InvalidTypeError){
            winston.error("[AVAILABILITY] Internal Error: Your description is not valid: {}".format(
                JSON.stringify(error)
            ));
        }else{
            //some unknown error, rethrow;
            throw error;
        }
    });
}

/* assign <player> to board <board-number> during round <round-number> on <team-name>*/
function assignAlternate(bot, message){
    var alternateOptions = message.league.options.alternate;
    if (!alternateOptions || !_.isEqual(message.channel, alternateOptions.channel_id)) {
        return;
    }
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }
    
    return commands.tokenize(message.text, [
        "assign", 
        "{text:player}", 
        "to", 
        "board", 
        "{int:boardNumber}", 
        "{during|for|in}",
        "round", 
        "{int:roundNumber}", 
        "{on|for|in}",
        "{text:teamName}"
    ]).then(function(parameters){
        var speaker = slack.getSlackUserFromNameOrID(message.user);
        var speakerTeam = message.league.getTeamByPlayerName(speaker.name);

        if (!message.league.isModerator(speaker.name)) {
            if (!_.isEqual(_.lowerCase(speakerTeam.name), _.lowerCase(parameters["teamName"]))) {
                replyThatsNotYourTeamName(bot, message, speakerTeam, parameters["teamName"]);
                return;
            }
        }
    
        if (!utils.isCaptainOrModerator(speaker, speakerTeam, parameters["teamName"], message.league)) {
            replyOnlyACaptainOrAModeratorCanDoThat(bot, message);
            return;
        }

        var boardNumber = parameters["boardNumber"];
        var roundNumber = parameters["roundNumber"];

        var team = message.league.getTeam(parameters["teamName"]);
        if(!team){
            replyUnrecognizedTeam(bot, message, parameters["teamName"]);
            return;
        }

        var player = slack.getSlackUserFromNameOrID(parameters["player"]);
        if(!player){
            replyFailedToUpdate(bot, message, "alternate assignment", "unknown player");
        }
        if(_(parameters["player"]).toUpper().includes(player.id)){
            //currently commands makes everything lower case
            //until I have added something to control the case-sensitivity
            //I will need to convert player ids to upper case.
            parameters["player"] = _.toUpper(parameters["player"]);
        }
        return heltour.assignAlternate(heltourOptions, 
            roundNumber, 
            team.number, 
            boardNumber, 
            player.name).then(function(){
            bot.reply(message, 
                "*{player}* has been assigned to *board {boardNumber}* for *{teamName}* during *round {roundNumber}*".format(parameters));
        }).catch(function(error){
            replyFailedToUpdate(bot, message, "alternate assignment", error);
        });
    }).catch(function(error){
        if(error instanceof commands.TooFewTokensError ||
            error instanceof commands.InvalidChoiceError ||
            error instanceof commands.InvalidConstantError ){
            winston.debug("[ASSIGNMENT] Invalid command format: {}".format(JSON.stringify(error)));
        }else if(error instanceof commands.InvalidTypeValueError){
            winston.debug("[ASSIGNMENT] Couldn't understand: ".format(JSON.stringify(error)));
            replyMisunderstoodAlternateAssignment(bot, message);
        }else if(error instanceof commands.InvalidTokenDescriptionError ||
                error instanceof commands.InvalidTypeError){
            winston.error("[ASSIGNMENT] Internal Error: Your description is not valid: {}".format(
                JSON.stringify(error)
            ));
        }else{
            //some unknown error, rethrow;
            throw error;
        }
    });
}

/* unassign alternate for board <board-number> during round <round-number> on <team-name> */
/* look up the original player and assign him to his board */
function unassignAlternate(bot, message){
    var alternateOptions = message.league.options.alternate;
    if (!alternateOptions || !_.isEqual(message.channel, alternateOptions.channel_id)) {
        return;
    }
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }
    
    var components = message.text.split(" ");
    var args = _.map(components.slice(0, 9), _.toLower);
    var teamName = components.splice(9).join(" ");
    var unassign    = args[0],
        alternate   = args[1],
        _for        = args[2],
        board       = args[3],
        boardNumber = args[4], 
        during      = args[5], 
        round       = args[6],
        roundNumber = args[7],
        on          = args[8];

    var speaker = slack.getSlackUserFromNameOrID(message.user);
    var speakerTeam = message.league.getTeamByPlayerName(speaker.name);

    if (!utils.isCaptainOrModerator(speaker, speakerTeam, teamName, message.league)) {
        replyOnlyACaptainOrAModeratorCanDoThat(bot, message);
        return;
    }

    // Ensure the basic command format is valid
    if (!_.isEqual(["unassign", "alternate", "for", "board", "during", "round", "on"], [unassign, alternate, _for, board, during, round, on])) {
        replyMisunderstoodAlternateUnassignment(bot, message);
        return;
    }

    boardNumber = parseInt(boardNumber, 10);
    if(isNaN(boardNumber)){
        replyMisunderstoodAlternateUnassignment(bot, message);
        return;
    }

    roundNumber = parseInt(roundNumber, 10);
    if(isNaN(roundNumber)){
        replyMisunderstoodAlternateUnassignment(bot, message);
        return;
    }

    var team = message.league.getTeam(teamName);
    var player;
    if(team){
        player = team.players[boardNumber-1].username;
    }else{
        replyUnrecognizedTeam(bot, message, teamName);
        return;
    }
    return heltour.assignAlternate(heltourOptions, roundNumber, team.number, boardNumber, player).then(function(){
        bot.reply(message, player + " has been assigned to board " + boardNumber + " for " + teamName + " during round " + roundNumber);
    }).catch(function(error){
        replyFailedToUpdate(bot, message, "alternate assignment", error);
    });
}

exports.updateAvailability = updateAvailability;
exports.assignAlternate = assignAlternate;
exports.unassignAlternate = unassignAlternate;
