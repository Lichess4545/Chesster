var moment = require("moment");
var fuzzy_match = require("./fuzzy_match");
var GoogleSpreadsheet = require("google-spreadsheet");
var _ = require("underscore");

var EXTREMA_DEFAULTS = {
    'isoWeekday': 2,
    'hour': 0,
    'minute': 0,
    'warningHours': 1
};
var BASE_DATE_FORMATS = [
    "YYYY-MM-DD MM DD",
    "YYYY-MM DD",
    "YYYY-MM-DD",
    "YYYY-MM-D",
    "YYYY-M-DD",
    "YYYY-M-D",
    "YY-MM-DD",
    "YY-MM-D",
    "YY-M-DD",
    "YY-M-D",
    "MM-DD-YYYY",
    "MM-D-YYYY",
    "M-DD-YYYY",
    "M-D-YYYY",
    "MM-DD-YY",
    "MM-D-YY",
    "M-DD-YY",
    "M-D-YY",
    "YYYY-DD-MM",
    "YYYY-D-MM",
    "YYYY-DD-M",
    "YYYY-D-M",
    "YY-DD-MM",
    "YY-D-MM",
    "YY-DD-M",
    "YY-D-M",
    "DD-MM-YYYY",
    "D-MM-YYYY",
    "DD-M-YYYY",
    "D-M-YYYY",
    "DD-MM-YY",
    "D-MM-YY",
    "DD-M-YY",
    "D-M-YY",
    "YYYY-MMMM DD",
    "YY-MMMM DD",
    "MMMM DD YYYY",
    "MMMM DD YY",
    "YYYY-DD MMMM",
    "YY-DD MMMM",
    "DD MMMM YYYY",
    "DD MMMM YY",
    "YYYY-MMMM D",
    "YY-MMMM D",
    "MMMM D YYYY",
    "MMMM D YY",
    "YYYY-D MMMM",
    "YY-D MMMM",
    "D MMMM YYYY",
    "D MMMM YY"
];
var BASE_TIME_FORMATS = [
    "HHmm",
    "Hmm",
    "HH-mm",
    "H-mm",
    "HH"
];
var DATE_FORMATS = [
];
BASE_DATE_FORMATS.forEach(function(dateFormat) {
    BASE_TIME_FORMATS.forEach(function(timeFormat) {
        DATE_FORMATS.push(dateFormat + " " + timeFormat);
        DATE_FORMATS.push(timeFormat + " " + dateFormat);
    });
});
var WORDS_TO_IGNORE = [
    "",
    "-",
    "–",
    "at",
    "on",
    "gmt",
    "gmt.",
    "gmt:",
    "rescheduled",
    "reschedule",
    "reschedule:",
    "to",
    "v",
    "vs",
    "versus",
    "white",
    "black",
    "pieces"
];

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

// A scheduling error (as opposed to other errors)
function ScheduleParsingError () {}
ScheduleParsingError.prototype = new Error();
function PairingError () {}
PairingError.prototype = new Error();

// Get an appropriate set of base tokens for the scheduling messages
function getTokensScheduling(inputString){
    // Do some basic preprocessing
    // Replace non-date punctuation/symbols with spaces
    inputString = inputString.replace(/[@,\(\)]/g, ' ');
    inputString = inputString.replace(/[<\>]/g, '');

    var parts = _.map(inputString.split(" "), function(item) {
        // Remove . and / and : and - from the beginning and end of the word
        item = item.replace(/^[:\.\/-]/g, '');
        item = item.replace(/[:\.\/-]$/g, '');

        return item;
    });
    parts = _.filter(parts, function(i) { return i.length > 0; });
    parts = _.filter(parts, function(i) {
        return WORDS_TO_IGNORE.indexOf(i.toLowerCase()) === -1;
    });
    return parts;
}

// Take the string they posted and turn it into a set of possible date
// strings by doing things like:
//
// Unifying the punctuation.
// removing gmt/utc
// Adding the current-year
// replacing day of the week tokens with the appropriate date format
function getPossibleDateStrings(dateString, extrema) {
    var dateStrings = [];

    // Unify some common stuff first.
    //
    // Change /.: to -
    dateString = dateString.replace(/[\/:\.]/g, '-');
    dateString = dateString.toLowerCase();
    dateString = dateString.replace(/gmt/g, "");
    dateString = dateString.replace(/utc/g, "");

    var dateNameMappings = {};

    var cur = extrema.start.clone();
    var now = moment.utc();
    while (!cur.isAfter(extrema.end)) {
        var monthDay = cur.format("MM-DD");
        // Deal with a couple of formats that moment doesn't produce but are used.
        if (cur.format("dddd") === "Thursday") {
            dateNameMappings["thurs"] = monthDay;
        } if (cur.format("dddd") === "Wednesday") {
            dateNameMappings["weds"] = monthDay;
        }
        dateNameMappings[cur.format("dd").toLowerCase()] = monthDay;
        dateNameMappings[cur.format("ddd").toLowerCase()] = monthDay;
        dateNameMappings[cur.format("dddd").toLowerCase()] = monthDay;
        dateNameMappings[cur.format("Do").toLowerCase()] = cur.format("DD");
        var month = cur.format("MM");
        dateNameMappings[cur.format("MMM").toLowerCase()] = month;
        dateNameMappings[cur.format("MMMM").toLowerCase()] = month;
        cur.add(1, 'days');
    }

    // Now make one where we map date names to their date
    var tokens = dateString.split(" ");
    tokens = _.map(tokens, function(part) {
        if (dateNameMappings[part.toLowerCase()]) {
            return dateNameMappings[part.toLowerCase()];
        } else {
            return part;
        }
    });
    dateStrings.push(tokens.join(" "));

    // now make one wher we remove date names completely.
    tokens = dateString.split(" ");
    tokens = _.map(tokens, function(part) {
        if (dateNameMappings[part.toLowerCase()]) {
            return "";
        } else {
            return part;
        }
    });
    tokens = _.filter(tokens, function(i) { return i.length > 0; });
    dateStrings.push(tokens.join(" "));

    // Now make some where we inject the year at the beginning
    now = moment.utc();
    year = now.format("YYYY");
    month = now.format("MM");
    dateStrings.slice().forEach(function(dateString) {
        dateStrings.push("" + year + "-" + dateString);
        dateStrings.push(dateString + "-" + year);
    });
    return dateStrings;
}

// Make an attempt to parse a scheduling string. 
//
// Parameters:
//     inputString: the string to try and parse 
//     options: options for both this method and are passed along to 
//         getRoundExtrema options
//     options.warningHours: an integer specifying how many hours
//         before the round end that we want to warn people about.
function parseScheduling(inputString, options) {
    var parts = getTokensScheduling(inputString);

    // Filter out word that we know we want to ignore.
    if (parts.length < 3) {
        console.log("Unable to parse date: " + inputString);
        throw new ScheduleParsingError();
    }

    // Now build up some possible strings and try a bunch of patterns
    // to find a date in our range.
    var extrema = getRoundExtrema(options);
    var dateStrings = getPossibleDateStrings(parts.slice(2).join(" "), extrema);

    var validInBoundsDate = [];
    var validOutOfBoundsDate = [];
    // Using _.every and returning false to break out of loops
    // checking every possible date format even after we have found
    // a valid one is wasteful, so this allows us to short circuit that process.
    _.every(dateStrings, function(dateString) {
        _.every(DATE_FORMATS, function(format) {
            var date = moment.utc(dateString, format, true);
            if (!date.isValid()) {
                return true;
            }
            validOutOfBoundsDate.push(date);
            // TODO: This check will prevent us from publishing pairings
            //       early AND having people announce their schedule early.
            //       Which is unfortunate, but I haven't thought of an elegant
            //       or easy way to allow for this. :/
            if (date.isBefore(extrema.start) || date.isAfter(extrema.end)) {
                return true;
            }
            validInBoundsDate.push(date);
            return false;
        });
        if (validInBoundsDate.length > 0) {
            return false;
        }
        return true;
    });
    if (validInBoundsDate.length === 0 && validOutOfBoundsDate.length === 0) {
        console.log("Unable to parse date: [" + inputString + "]");
        throw new ScheduleParsingError();
    }

    // strip out any punctuation from the usernames
    var white = parts[0].replace(/[@\.,\(\):]/g, '');
    var black = parts[1].replace(/[@\.,\(\):]/g, '');

    var date;
    var outOfBounds = false;
    var warn = false;

    if (validInBoundsDate.length === 0 && validOutOfBoundsDate.length > 0) {
        date = validOutOfBoundsDate[0];
        outOfBounds = true;
    } else {
        date = validInBoundsDate[0];
        if (date.isAfter(extrema.warning)) {
            warn = true;
        }
    }
    return {
        white: white,
        black: black,
        date: date,
        warn: warn,
        outOfBounds: outOfBounds
    };
}

// Calculate the extrema of the current round for both leagues.
//
// Each league has  slightly different requirements for when your
// game must be played. This method will return the given start datetime
// and end datetime for the round.
//
// Options:
//     extrema.referenceDate: If this is provided it the round is guaranteed
//       to include this date. Mostly used for tests.
//     extrema.isoWeekday: The weekday after which games cannot be scheduled.
//     extrema.hour: The hour after which games cannot be scheduled.
//     extrema.hour: The weekday on which the pairings are released.
//     extrema.warningHours: The amount of hours before the final scheduling
//       cutoff during which we will warn users they are cutting it close.
function getRoundExtrema(options) {
    options = options || {};
    extrema = {};
    _.extend(extrema, EXTREMA_DEFAULTS, options.extrema);

    // Get the reference date, which is either today or the referenceDate
    // from the options
    if (!extrema.referenceDate) {
        roundStart = moment.utc();
    } else {
        roundStart = moment(extrema.referenceDate).clone();
    }
    referenceDate = roundStart.clone()
    // Make it the right time of day.
    roundStart.hour(extrema.hour).minute(extrema.minute).second(0);

    // Find the first day that comes before our reference date
    // which is on th same weekday as the round starts.
    while (roundStart.isoWeekday() !== extrema.isoWeekday || roundStart.isAfter(referenceDate)) {
        roundStart.subtract(1, 'days');
    }

    // The end is always 7 days in advance
    var roundEnd = roundStart.clone().add(7, 'days');
    var warningEnd = roundEnd.clone().subtract(extrema.warningHours, 'hours');
    return {
        'start': roundStart,
        'end': roundEnd,
        'warning': warningEnd
    };
}

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
                    var recordRows = [];
                    rows.slice(2).forEach(function(row) {
                        recordRows.push(_.object(_.zip(headerRow, row)));
                    });
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
            if(resultString !== "-"){
                //this is just the addition of a result
                //we will use the gamelink to verify the result if we have it
                if(reversed){
                    //switch the result
                    var lhs = resultString.split('-')[0];
                    var rhs = resultString.split('-')[1];
                    resultString = rhs + '-' + lhs;
                }
            }

            //get the formula, if there is one
            var formula = resultCell.formula;
            
            var gamelink;
            if(!gamelinkID && formula && formula.toUpperCase().includes("HYPERLINK")){
                //there is no gamelink, fill from the formula
                gamelink = formula.split("\"")[1];
            }else if(!result.gamelinkID){
                //no gamelink and no formula
                gamelink = '';
            }else{
                gamelink =  "http://en.lichess.org/" + result.gamelinkID;
            }

            //if no game link is found, just post the result
            if(_.isEqual(gamelink, "")){
                resultCell.value = resultString;
            }else{
                resultCell.formula = '=HYPERLINK("' + gamelink + '","' + resultString + '")';
            }

            //save the cell in the spreadsheet
            resultCell.save(function(err){
                return callback(err, reversed);
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
    if (parts[0].toUpperCase() !== "=HYPERLINK(") {
        return results;
    }
    results['href'] = parts[1];
    results['text'] = parts[3];
    return results;
}

module.exports.getRows = getRows;
module.exports.getPairingRows = getPairingRows;
module.exports.getRoundExtrema = getRoundExtrema;
module.exports.parseScheduling = parseScheduling;
module.exports.parseResult = parseResult;
module.exports.parseGamelink = parseGamelink;
module.exports.parseHyperlink = parseHyperlink;
module.exports.updateSchedule = updateSchedule;
module.exports.updateResult = updateResult;
module.exports.fetchPairingGameLink = fetchPairingGameLink;
module.exports.ScheduleParsingError = ScheduleParsingError;
module.exports.PairingError = PairingError;
