//------------------------------------------------------------------------------
// Commands and helpers related to gamelinks and results
//------------------------------------------------------------------------------
const _ = require("lodash");
const moment = require("moment-timezone");
const winston = require("winston");
const scheduling = require("./scheduling");
const subscription = require("./subscription");
const heltour = require('../heltour.js');
const http = require("../http.js");

const TIMEOUT = 33;
const CHEAT = 36;
var SWORDS = '\u2694';

var VALID_RESULTS = {
    "0-0":"0-0",
    "1-0":"1-0",
    "0-1":"0-1",
    "1/2-1/2":"1/2-1/2",
    "0.5-0.5":"1/2-1/2",
    "1X-0F":"1X-0F",
    "0F-1X":"0F-1X",
    "0F-0F":"0F-0F",
    "1/2Z-1/2Z":"1/2Z-1/2Z",
    "0.5Z-0.5Z":"1/2Z-1/2Z",
    "DRAW":"1/2-1/2",
    "DREW":"1/2-1/2",
    "GIRI":"1/2-1/2"
};

// parse the input string for a results update
function parseResult(inputString){
    var tokens = getTokensResult(inputString);   
    var result = findResult(tokens);
    var players = findPlayers(tokens);
    
    return {
        "white": players.white,
        "black": players.black,
        "result": result
    };
}

function getTokensResult(inputString){
    return inputString.split(" ");
}

function findResult(tokens){
    var result;
    _.some(tokens, function(token){
        return (result = VALID_RESULTS[token.toUpperCase()]) ? true : false;
    });
    return result;
}

function findPlayers(tokens){
    // in reality, the order is arbitrary.
    // just assuming first I find is white, the second is black
    var players = {};
    var playerTokens = filterPlayerTokens(tokens);

    //assuming we found 2 tokens, we should convert them to player names
    if(playerTokens.length === 2){
        //remove punctuation and store. this fixes losts of stuff.
        //most frequent issue is the : added after a name by slack
        players.white = playerTokens[0].replace(/[:,.-]/, "");
        players.black = playerTokens[1].replace(/[:,.-]/, "");
    }

    return players;
}

function filterPlayerTokens(tokens){
    return _.filter(tokens, function(token){
        //matches slack uer ids: <@[A-Z0-9]>[:]*
        return /^<@[A-Z0-9]+>[:,.-]*$/.test(token);
    });
}

function handleHeltourErrors(bot, message, error){
    if (_.isEqual(error, "no_matching_rounds")) {
        replyNoActiveRound(bot, message);
    } else if (_.isEqual(error, "no_pairing")) {
        resultReplyMissingPairing(bot, message);
    } else if (_.isEqual(error, "ambiguous")) {
        resultReplyTooManyPairings(bot, message);
    } else {
        replyGenericFailure(bot, message, "@endrawes0");
        throw new Error("Error making your update: " + error);
    }
}

function ambientResults(bot, message) {
    if(!message.league){
        return;
    }
    var resultsOptions = message.league.options.results; 
    var channel = bot.channels.byId[message.channel];
    if (!channel) {
        return;
    }
    if (!resultsOptions || !_.isEqual(channel.name, resultsOptions.channel)){
        return;
    }

    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }

    var gamelinkOptions = message.league.options.gamelinks;
    if (!gamelinkOptions) {
        return;
    }

    try{
        var result = parseResult(message.text);

        if(!result.white || !result.black || !result.result){
            return;
        }

        result.white = bot.users.getByNameOrID(result.white.replace(/[<\@>]/g, ''));
        result.black = bot.users.getByNameOrID(result.black.replace(/[<\@>]/g, ''));

        if(!result.white || !result.black) {
            replyPlayerNotFound(bot, message);
            return;
        }

        if(
            !_.isEqual(result.white.id, message.user) &&
            !_.isEqual(result.black.id, message.user) &&
            !message.player.isModerator()
        ){
            replyPermissionFailure(bot, message);
            return;
        }
        
        return heltour.findPairing(
            heltourOptions,
            result.white.name,
            result.black.name,
            heltourOptions.leagueTag
        ).then(function(findPairingResult){
            if(findPairingResult["error"]){
                handleHeltourErrors(bot, message, findPairingResult["error"]);
                return;
            }

            var pairing = _.head(findPairingResult["json"].pairings);
            if( !_.isNil(pairing) 
                && !_.isNil(pairing.game_link) 
                && !_.isEqual(pairing.game_link, "")){
                //process game details
                processGamelink(
                    bot, 
                    message,
                    pairing.game_link,
                    gamelinkOptions,
                    heltourOptions,
                    result);
            }else if(!_.isNil(pairing)){
                var speaker = bot.getSlackUserFromNameOrID(message.user);
                if(message.league.isModerator(speaker.name)){
                    //current speaker is a moderator for the league
                    //update the pairing with the result bc there was no link found
                    heltour.updatePairing(
                        heltourOptions,
                        result
                    ).then(function(updatePairingResult) {
                        if (updatePairingResult['error']) {
                            handleHeltourErrors(bot, message, updatePairingResult['error']);
                            return;
                        }
                        resultReplyUpdated(bot, message, updatePairingResult);

                        var leagueName = message.league.options.name;
                        var white = result.white;
                        var black = result.black;
                        if(updatePairingResult['resultChanged'] && !_.isEmpty(updatePairingResult.result)){
                            subscription.emitter.emit('a-game-is-over',
                                message.league,
                                [white.name, black.name],
                                {
                                    'result': updatePairingResult,
                                    'white': white,
                                    'black': black,
                                    'leagueName': leagueName
                                }
                            );
                        }
                    });
                }else{
                    resultReplyMissingGamelink(bot, message);
                }
            }else{
                resultReplyMissingPairing(bot, message);
            }
        });
    }catch(e){
        //at the moment, we do not throw from inside the api - rethrow
        throw e;
    }
}

function replyPermissionFailure(bot, message){
    bot.reply(message, "Sorry, you do not have permission to update that pairing.");
}

function replyPlayerNotFound(bot, message){
    bot.reply(message, "Sorry, I could not find one of the players on Slack.");
}

function resultReplyMissingGamelink(bot, message){
    var channel = bot.channels.byName[message.league.options.gamelinks.channel];
    bot.reply(message, "Sorry, that game does not have a link. I will not update the result without it.");
    bot.reply(message, "Please go to <#" +channel.id + "> and post the gamelink.");
}

function resultReplyMissingPairing(bot, message){
    bot.reply(message, "Sorry, I could not find that pairing.");
}

function resultReplyTooManyPairings(bot, message){
    bot.reply(message, "Sorry, I found too many pairings matching this. Please contact a mod.");
}

function replyNoActiveRound(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " There is currently no active round. If this is a mistake, contact a mod");
}

function resultReplyUpdated(bot, message, result){
    bot.reply(message, "Got it. @" + result.white.name + " " + (result.result || SWORDS) + " @" + result.black.name);
}

//given the input text from a essage
function parseGamelink(messageText){
    //split it into tokens separated by white space and slashes
    var tokens = messageText.split(/[<>\|\/\s]/);
    var foundBaseURL = false;
    var gamelinkID;

    //for each token, walk the list looking for a lichess url
    tokens.some(function(token){
        //if previously token was a lichess url
        //this token should be the gamelinkID
        if(foundBaseURL){
            gamelinkID = token.replace('>', '');
            //some tokens will have a > if its the last token
            //return true to stop iterating
            return true;
        }
        //current token is the base of the lichess url
        if(token.includes("lichess.org")){
            foundBaseURL = true;
        }
        return false;
    });
    return { gamelinkID: gamelinkID };
}

function validateGameDetails(league, details) {
    var result = {
        valid: true,
        pairing: null,
        pairingWasNotFound: false,
        colorsAreReversed: false,
        gameIsUnrated: false,
        timeControlIsIncorrect: false,
        variantIsIncorrect: false,
        gameOutsideOfCurrentRound: false,
        claimVictoryNotAllowed: false,
        cheatDetected: false,
        reason: ""
    };
    var options = league.options.gamelinks;

    var white = details.players.white.userId;
    var black = details.players.black.userId;

    var potentialPairings = league.findPairing(white, black);
    var pairing = result.pairing = _.head(potentialPairings);
    if(potentialPairings.length === 0) {
        result.valid = false;
        result.pairingWasNotFound = true;
        result.reason = "the pairing was not found.";
    }else if( !details.clock || ( // no clock - unlimited or coorespondence
        details.clock && ( //clock
            !_.isEqual(details.clock.initial, options.clock.initial * 60) || // initial time
            !_.isEqual(details.clock.increment, options.clock.increment) ) // increment
        ) 
    ){
        //the time control does not match options
        result.valid = false;
        result.timeControlIsIncorrect = true;
        result.reason = "the time control is incorrect.";
    }else if(potentialPairings.length === 1 && pairing && _.isEqual(_.toLower(pairing.white), black)){
        result.valid = false;
        result.colorsAreReversed = true;
        result.reason =  "the colors are reversed.";
    }else if(!_.isEqual(details.rated, options.rated)){
        //the game is not rated correctly
        result.valid = false;
        result.gameIsUnrated = true;
        result.reason = "the game is " + ( options.rated ? "unrated." : "rated." );
    }else if(!_.isEqual(details.variant, options.variant)){
        //the variant does not match
        result.valid = false;
        result.variantIsIncorrect = true;
        result.reason = "the variant should be standard.";
    }else if(_.isEqual(details.status, TIMEOUT)) {
        //claim victory is not allowed
        result.valid = false;
        result.claimVictoryNotAllowed = true;
        result.reason = "using \"Claim Victory\" is not permitted. Contact a mod.";
    }else if(_.isEqual(details.status, CHEAT)) {
        // Cheating is not allowed.
        result.valid = false;
        result.cheatDetected = true;
        result.reason = "The game ended with a \"Cheat Detected\". Contact a mod.";
    }else{
        //the link is too old or too new
        var extrema = scheduling.getRoundExtrema(options);
        var game_start = moment.utc(details.createdAt);
        if(game_start.isBefore(extrema.start) || game_start.isAfter(extrema.end)){
            result.valid = false;
            result.gameOutsideOfCurrentRound = true;
            result.reason = "the game was not played in the current round.";
        }
    }
    return result;
}

//given a gamelinkID, use the lichess api to get the game details
//pass the details to the callback as a JSON object
function fetchGameDetails(gamelinkID){
    return http.fetchURLIntoJSON("http://en.lichess.org/api/game/" + gamelinkID);
}

function gamelinkReplyInvalid(bot, message, reason){
    bot.reply(message, "I am sorry, <@" + message.user + ">,  "
                     + "your post is *not valid* because "
                     + "*" + reason + "*");
    bot.reply(message, "If this was a mistake, please correct it and "
                     + "try again. If intentional, please contact one "
                     + "of the moderators for review. Thank you.");
}

function replyGenericFailure(bot, message, contact){
    bot.reply(message, "Something went wrong. Notify " + contact);
}

function gamelinkReplyUnknown(bot, message){
    bot.reply(message, "Sorry, I could not find that game. Please verify your gamelink.");
}

function validateUserResult(details, result){
    //if colors are reversed, in the game link, we will catch that later
    //we know the players are correct or we would not already be here
    //the only way we can validate the result is if the order is 100% correct.
    var validity = {
        valid: true,
        reason: ""
    };
    if( details.winner && _.isEqual(result.result, "1/2-1/2")){
        //the details gave a winner but the user claimed draw
        validity.reason = "the user claimed a draw " 
                        + "but the gamelink specifies " + details.winner + " as the winner.";
        validity.valid = false;
   }else if(_.isEqual(details.winner, "black") && _.isEqual(result.result, "1-0")){
        //the details gave the winner as black but the user claimed white
        validity.reason = "the user claimed a win for white " 
                        + "but the gamelink specifies black as the winner.";
        validity.valid = false;
    }else if(_.isEqual(details.winner, "white") && _.isEqual(result.result, "0-1")){
        //the details gave the winner as white but the user claimed black
        validity.reason = "the user claimed a win for black " 
                        + "but the gamelink specifies white as the winner.";
        validity.valid = false;
    }else if(_.isEqual(details.status, "draw") && !_.isEqual(result.result, "1/2-1/2")){
        //the details gave a draw but the user did not claim a draw
        validity.reason = "the user claimed a decisive result " 
                        + "but the gamelink specifies a draw.";
        validity.valid = false;
    }
    return validity;
}

function processGamelink(bot, message, gamelink, options, heltourOptions, userResult){
    //get the gamelink id if one is in the message
    var result = parseGamelink(gamelink);
    if(!result.gamelinkID){
        //no gamelink found. we can ignore this message
        return;
    }
    //get the game details
    return fetchGameDetails(result.gamelinkID).then(function(response) {
        var details = response['json'];
        //validate the game details vs the user specified result
        if(userResult){
            var validity = validateUserResult(details, userResult);
            if(!validity.valid){
                gamelinkReplyInvalid(bot, message, validity.reason);
                return;
            }
        }
        return processGameDetails(bot, message, details);
    }).catch(function(error) {
        winston.error(JSON.stringify(error));
        bot.reply(message, "Sorry, I failed to get game details for " + gamelink + ". Try again later or reach out to a moderator to make the update manually.");
    });
}

function processGameDetails(bot, message, details){
    //if no details were found the link was no good
    if(!details){
        gamelinkReplyUnknown(bot, message);
        return;
    }

    //verify the game meets the requirements of the channel we are in
    var validity = validateGameDetails(message.league, details);
    if(!validity.valid){
        //game was not valid
        gamelinkReplyInvalid(bot, message, validity.reason);
        return;
    }
    return updateGamelink(message.league, details).then(function(updatePairingResult) {
        resultReplyUpdated(bot, message, updatePairingResult);
    }).catch(function(error) {
        if (error instanceof heltour.HeltourError) {
            handleHeltourErrors(bot, message, error.code);
        } else {
            winston.error(JSON.stringify(error));
        }
    });
}

function updateGamelink(league, details) {
    var result = {};
    //our game is valid
    //get players to update the result in the sheet
    var white = details.players.white;
    var black = details.players.black;
    result.white = league.bot.users.getByNameOrID(white.userId);
    result.black = league.bot.users.getByNameOrID(black.userId);
    result.gamelinkID = details.id;
    result.gamelink =  "http://en.lichess.org/" + result.gamelinkID;
 
    //get the result in the correct format
    if(_.isEqual(details.status, "draw") || _.isEqual(details.status, "stalemate") || details.winner){
        if(_.isEqual(details.winner, "black")){
            result.result = "0-1";
        }else if(_.isEqual(details.winner, "white")){
            result.result = "1-0";
        }else{
            result.result = "1/2-1/2";
        }
    }

    //gamelinks only come from played games, so ignoring forfeit result types

    //update the spreadsheet with results from gamelink
    return heltour.updatePairing(
        league.options.heltour,
        result
    ).then(function(updatePairingResult) {
        if (updatePairingResult['error']) {
            //if there was a problem with heltour, we should not take further steps
            throw new heltour.HeltourError(updatePairingResult['error']); 
        }

        var leagueName = league.options.name;
        var white = result.white;
        var black = result.black;
        if(updatePairingResult['resultChanged'] && !_.isEmpty(updatePairingResult.result)){
            // TODO: Test this.
            subscription.emitter.emit('a-game-is-over',
                league,
                [white.name, black.name],
                {
                    'result': updatePairingResult,
                    'white': white,
                    'black': black,
                    'leagueName': leagueName
                }
            );
        }else if(updatePairingResult['gamelinkChanged']){
            // TODO: Test this.
            subscription.emitter.emit('a-game-starts',
                league,
                [white.name, black.name],
                {
                    'result': result,
                    'white': white,
                    'black': black,
                    'leagueName': leagueName
                }
            );
        }
        return updatePairingResult;
    });
}

function ambientGamelinks(bot, message) {
    if (!message.league) {
        return;
    }
    var channel = bot.channels.byId[message.channel];
    if (!channel) {
        return;
    }
    var gamelinkOptions = message.league.options.gamelinks;
    if (!gamelinkOptions || !_.isEqual(channel.name, gamelinkOptions.channel)) {
        return;
    }
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("[GAMELINK] {} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    } 

    try{
        return processGamelink(bot, message, message.text, gamelinkOptions, heltourOptions);
    }catch(e){
        //at the moment, we do not throw from inside the api - rethrow
        throw e;
    }
}

module.exports.parseResult = parseResult;
module.exports.ambientResults = ambientResults;
module.exports.parseGamelink = parseGamelink;
module.exports.validateGameDetails = validateGameDetails;
module.exports.fetchGameDetails = fetchGameDetails;
module.exports.updateGamelink = updateGamelink;
module.exports.ambientGamelinks = ambientGamelinks;
