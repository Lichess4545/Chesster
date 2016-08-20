var _ = require("lodash");

//given the input text from a essage
function parseGamelink(messageText){
    //split it into tokens separated by white space and slashes
    var tokens = messageText.split(/[\<\>\|\/\s]/);
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

//given a pairing, get a game link if one already exists
function fetchPairingGameLink(spreadsheetConfig, result, callback){
    var white = result.white;
    var black = result.black;

    //given a pairing, white and black, get the row in the spreadsheet
    findPairing(
        spreadsheetConfig,
        white.name,
        black.name,
        function(err, row){
            if(err){
                callback(err);
            }
            resultCell = row[spreadsheetConfig.resultsColname];
            var formula = resultCell.formula;
            if(formula && formula.toUpperCase().includes("HYPERLINK")){
                callback(err, formula.split("\"")[1]);
            }else{
                callback(err, undefined);
            }
        }
    );
}


module.exports.parseGamelink = parseGamelink;
module.exports.fetchPairingGameLink = fetchPairingGameLink;
