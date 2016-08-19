var moment = require("moment");
var fuzzy_match = require("./fuzzy_match");
var GoogleSpreadsheet = require("google-spreadsheet");
var _ = require("lodash");
var winston = require("winston");

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

// getRows is a client side implementation of the record-type results that we
// got from the row based API. Instead, we now implement this in the following
// manner:
//   1. Query for all cells in a particular range.
//   2. Asssume first row is a header row.
//   3. Turn each subsequent row into an object, of key-values based on the header
//   4. return rows.
function getRows(spreadsheetConfig, options, sheetPredicate, callback) {
    var doc = new GoogleSpreadsheet(spreadsheetConfig.key);

    function getRowImplementation(err, info) {
        var targetSheet;

        if (err) {
            callback(err, undefined);
        }

        doc.getInfo(function(err, info) {
            if (err) { return callback(err, info); }
            // Find the last spreadsheet with the word "round" in the title.
            // this ought to work for both tournaments
            info.worksheets.forEach(function(sheet) {
                if (sheetPredicate(sheet)) {
                    targetSheet = sheet;
                }
            });
            if (!targetSheet) {
                callback("Unable to find target worksheet");
                return;
            }
            // Query for the appropriate row.
            // Again, this ought to work for both tournaments
            options = _.clone(options);
            var defaults = {
                'min-row': 1,
                'max-row': 100,
                'min-col': 1,
                'max-col': 8,
                'return-empty': true
            }
            options = _.defaults(options, defaults);
            targetSheet.getCells(
                options,
                function(err, cells) {
                    if (err) { return callback(err, cells); }

                    // Take the single list and turn it into rows
                    var rows = [];
                    cells.forEach(function(cell) {
                        // Create the empty row if needed.
                        if (!(cell.row in rows)) {
                            rows[cell.row] = [];
                        }
                        rows[cell.row][cell.col] = cell;
                    });

                    // Convert each row into a record with keys
                    var headerRow = rows[1];
                    headerRow = _.map(headerRow, function(item, i) {
                        if (item) {
                            return item.value.toLowerCase();
                        } else {
                            return i;
                        }
                    });
                    var recordRows = _.map(rows.slice(2), function(row) {
                        return _.zipObject(headerRow, row);
                    })
                    callback(undefined, recordRows);
                }
            );
        });
    }

    if (spreadsheetConfig.serviceAccountAuth) {
        doc.useServiceAccountAuth(spreadsheetConfig.serviceAccountAuth, getRowImplementation);
    } else {
        getRowImplementation();
    }
}




// getPairingRows returns the pairing rows from the spreadsheet
function getPairingRows(spreadsheetConfig, options, callback) {
    return getRows(
        spreadsheetConfig,
        options,
        function(sheet) {
            return sheet.title.toLowerCase().indexOf("round") !== -1;
        },
        callback
    );
}

// Finds the given pairing in one of the team spreadsheets
// callback gets three values: error, row, whether the pairing is reversed or not.
function findPairing(spreadsheetConfig, white, black, callback) {
    var options = {
        'min-col': 1,
        'max-col': 7
    };
    function rowMatchesPairing(row) {
        var rowBlack = row.black.value.toLowerCase();
        var rowWhite = row.white.value.toLowerCase();
        if (
            (rowBlack.indexOf(black) !== -1 && rowWhite.indexOf(white) !== -1)
        ) {
            return true;
        } else if (
            (rowWhite.indexOf(black) !== -1 && rowBlack.indexOf(white) !== -1)
        ) {
            return true;
        }
        return false;
    }
    getPairingRows(
        spreadsheetConfig,
        options,
        function(err, rows) {
            var filteredRows = _.filter(rows, rowMatchesPairing);
            // Only update it if we found an exact match
            if (filteredRows.length > 1) {
                return callback("Unable to find pairing. More than one row was returned!");
            } else if(filteredRows.length < 1) {
                return callback("Unable to find pairing. No rows were returned!");
            }
            var row = filteredRows[0];
            var rowBlack = row.black.value.toLowerCase();
            var rowWhite = row.white.value.toLowerCase();
            var reversed = false;
            if (rowWhite.indexOf(black) !== -1) {
                reversed = true
            }
            callback(undefined, row, reversed);
        }
    );
}

// Update the schedule
function updateSchedule(spreadsheetConfig, schedulingConfig, schedule, callback) {
    var white = schedule.white;
    var black = schedule.black;
    var date = schedule.date;
    findPairing(spreadsheetConfig, white, black, function(err, row, reversed) {
        if (err) {
            return callback(err);
        }
        // This portion is specific to the team tournament
        var scheduleCell = row[spreadsheetConfig.scheduleColname];
        scheduleCell.value = date.format(schedulingConfig.format);

        scheduleCell.save(function(err) {
            return callback(err, reversed);
        });
    });
}

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
        return /^\<@[A-Z0-9]+\>[:,.-]*$/.test(token);
    });
}

function isHYPERLINK(string){
    return string && string.toUpperCase().includes("HYPERLINK");
}

//assumes formula is a valid HYPERLINK formula
function parseHYPERLINK(formula){
   return { 
        gamelink: formula.split("\"")[1],
        result: formula.split("\"")[3]
    };
}

//this assumes it is being given a valid result - that is th contract
//error handling for a bad result should happen outside this function
function updateResult(spreadsheetConfig, result, callback){
    var white = result.white;
    var black = result.black;
    var resultString = result.result;
    var gamelinkID = result.gamelinkID;

    findPairing(
        spreadsheetConfig, 
        white.name, 
        black.name, 
        function(err, row, reversed){
            if(err){
                return callback(err);
            }
            var resultCell = row[spreadsheetConfig.resultsColname];

            //a gamelink was passed in and the names were reversed
            if(gamelinkID && reversed){
                //this is an error - games must be played by proper colors
                return callback("the colors are reversed.", true);
            }
            if(!_.isEqual(resultString, "-")){
                //this is just the addition of a result
                //we will use the gamelink to verify the result if we have it
                if(reversed){
                    //switch the result
                    var lhs = resultString.split('-')[0];
                    var rhs = resultString.split('-')[1];
                    resultString = rhs + '-' + lhs;
                }
            }

            //get the formula and parse it, if there is one
            var formula = resultCell.formula;
            var isHyperlink = isHYPERLINK(formula);
            var hyperlink = isHyperlink && parseHYPERLINK(formula);

            var gamelink;
            var gamelinkChanged = false;
            if(!gamelinkID && isHyperlink){
                //there is no gamelink, fill from the formula
                gamelink = hyperlink.gamelink;
            }else if(!result.gamelinkID){
                //no gamelink and no formula
                gamelink = '';
            }else{
                gamelink =  "http://en.lichess.org/" + result.gamelinkID;
                gamelinkChanged = true;
            }

            //if no game link is found, just post the result
            var resultChanged = false;
            if(_.isEqual(gamelink, "")){
                if(!_.isEqual(resultCell.value, resultString)){
                    resultCell.value = resultString;
                    resultChanged = true;
                }
            }else{
                if(isHyperlink && !_.isEqual(hyperlink.result, resultString)){
                    resultChanged = true;
                }else if(!isHyperlink && !_.isEqual(resultCell.value, resultString)){
                    resultChanged = true;
                }
                resultCell.formula = '=HYPERLINK("' + gamelink + '","' + resultString + '")';
            }

            //save the cell in the spreadsheet
            resultCell.save(function(err){
                return callback(err, reversed, gamelinkChanged, resultChanged);
            });
        }
    );
}

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

// Given '=HYPERLINK("http://en.lichess.org/FwYcks48","1-0")'
// return {'text': '1-0', 'url': 'http://en.lichess.org/FwYcks48'}
function parseHyperlink(hyperlink) {
    var results = {
        'text': '',
        'href': ''
    };
    if(!hyperlink.toUpperCase().includes("HYPERLINK")) {
        return results;
    }
    var parts = hyperlink.split("\"");
    if (parts.length !== 5) {
        return results;
    }
    if (!_.isEqual(parts[0].toUpperCase(), "=HYPERLINK(")) {
        return results;
    }
    results['href'] = parts[1];
    results['text'] = parts[3];
    return results;
}

module.exports.getRows = getRows;
module.exports.getPairingRows = getPairingRows;
module.exports.parseResult = parseResult;
module.exports.parseGamelink = parseGamelink;
module.exports.parseHyperlink = parseHyperlink;
module.exports.updateSchedule = updateSchedule;
module.exports.updateResult = updateResult;
module.exports.fetchPairingGameLink = fetchPairingGameLink;
