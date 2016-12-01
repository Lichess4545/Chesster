var _ = require("lodash");

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

module.exports.parseResult = parseResult;
module.exports.parseGamelink = parseGamelink;
