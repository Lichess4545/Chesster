var moment = require("moment");
var fuzzy_match = require("./fuzzy_match");
var GoogleSpreadsheet = require("google-spreadsheet");
var _ = require("underscore");

var EXTREMA_DEFAULTS = {
    'iso_weekday': 2,
    'hour': 0,
    'minute': 0,
    'warning_hours': 1,
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
    "D MMMM YY",
];
var BASE_TIME_FORMATS = [
    "HHmm",
    "Hmm",
    "HH-mm",
    "H-mm"
];
var DATE_FORMATS = [
];
BASE_DATE_FORMATS.forEach(function(date_format) {
    BASE_TIME_FORMATS.forEach(function(time_format) {
        DATE_FORMATS.push(date_format + " " + time_format);
        DATE_FORMATS.push(time_format + " " + date_format);
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
function get_tokens_scheduling(input_string){
    // Do some basic preprocessing
    // Replace non-date punctuation/symbols with spaces
    input_string = input_string.replace(/[@,\(\)]/g, ' ');
    input_string = input_string.replace(/[<\>]/g, '');

    var parts = _.map(input_string.split(" "), function(item) {
        // Remove . and / and : and - from the beginning and end of the word
        item = item.replace(/^[:\.\/-]/g, '');
        item = item.replace(/[:\.\/-]$/g, '');

        return item;
    });
    parts = _.filter(parts, function(i) { return i.length > 0; });
    parts = _.filter(parts, function(i) {
        return WORDS_TO_IGNORE.indexOf(i.toLowerCase()) == -1;
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
function get_possible_date_strings(date_string, extrema) {
    var date_strings = [];

    // Unify some common stuff first.
    //
    // Change /.: to -
    date_string = date_string.replace(/[\/:\.]/g, '-');
    date_string = date_string.toLowerCase();
    date_string = date_string.replace(/gmt/g, "");
    date_string = date_string.replace(/utc/g, "");

    var date_name_mappings = {};

    var cur = extrema.start.clone();
    var now = moment.utc();
    while (!cur.isAfter(extrema.end)) {
        var month_day = cur.format("MM-DD");
        // Deal with a couple of formats that moment doesn't produce but are used.
        if (cur.format("dddd") == "Thursday") {
            date_name_mappings["thurs"] = month_day;
        } if (cur.format("dddd") == "Wednesday") {
            date_name_mappings["weds"] = month_day;
        }
        date_name_mappings[cur.format("dd").toLowerCase()] = month_day;
        date_name_mappings[cur.format("ddd").toLowerCase()] = month_day;
        date_name_mappings[cur.format("dddd").toLowerCase()] = month_day;
        date_name_mappings[cur.format("Do").toLowerCase()] = cur.format("DD");
        var month = cur.format("MM");
        date_name_mappings[cur.format("MMM").toLowerCase()] = month;
        date_name_mappings[cur.format("MMMM").toLowerCase()] = month;
        cur.add(1, 'days');
    }

    // Now make one where we map date names to their date
    var tokens = date_string.split(" ");
    tokens = _.map(tokens, function(part) {
        if (date_name_mappings[part.toLowerCase()]) {
            return date_name_mappings[part.toLowerCase()];
        } else {
            return part;
        }
    });
    date_strings.push(tokens.join(" "));

    // now make one wher we remove weekdays
    tokens = date_string.split(" ");
    tokens = _.map(tokens, function(part) {
        if (date_name_mappings[part.toLowerCase()]) {
            return "";
        } else {
            return part;
        }
    });
    tokens = _.filter(tokens, function(i) { return i.length > 0; });
    date_strings.push(tokens.join(" "));

    // Now make some where we inject various date pieces into the string.
    var now = moment.utc();
    year = now.format("YYYY");
    month = now.format("MM");
    date_strings.slice().forEach(function(date_string) {
        date_strings.push("" + year + "-" + date_string);
    });
    //console.log(date_strings);
    //date_strings.push("" + year + month + date_string);
    return date_strings;
}

// Make an attempt to parse a scheduling string. 
//
// Parameters:
//     input_string: the string to try and parse 
//     options: options for both this method and are passed along to 
//         get_round_extrema options
//     options.warning_hours: an integer specifying how many hours
//         before the round end that we want to warn people about.
function parse_scheduling(input_string, options) {
    var parts = get_tokens_scheduling(input_string);

    // Filter out word that we know we want to ignore.
    if (parts.length < 3) {
        console.log("Unable to parse date: " + input_string);
        throw new ScheduleParsingError();
    }

    // Now build up some possible strings and try a bunch of patterns
    // to find a date in our range.
    var extrema = get_round_extrema(options);
    var date_strings = get_possible_date_strings(parts.slice(2).join(" "), extrema);

    var valid_in_bounds_dates = [];
    var valid_out_of_bounds_dates = [];
    // Using _.every and returning false to break out of loops
    // checking every possible date format even after we have found
    // a valid one is wasteful, so this allows us to short circuit that process.
    _.every(date_strings, function(date_string) {
        _.every(DATE_FORMATS, function(format) {
            var date = moment.utc(date_string, format, true);
            if (!date.isValid()) {
                return true;
            }
            valid_out_of_bounds_dates.push(date);
            // TODO: This check will prevent us from publishing pairings
            //       early AND having people announce their schedule early.
            //       Which is unfortunate, but I haven't thought of an elegant
            //       or easy way to allow for this. :/
            if (date.isBefore(extrema.start) || date.isAfter(extrema.end)) {
                return true;
            }
            valid_in_bounds_dates.push(date);
            return false;
        });
        if (valid_in_bounds_dates.length > 0) {
            return false;
        }
        return true;
    });
    if (valid_in_bounds_dates.length == 0 && valid_out_of_bounds_dates.length == 0) {
        console.log("Unable to parse date: [" + input_string + "]");
        throw new ScheduleParsingError();
    }

    // strip out any punctuation from the usernames
    var white = parts[0].replace(/[@\.,\(\):]/g, '');
    var black = parts[1].replace(/[@\.,\(\):]/g, '');

    var date;
    var out_of_bounds = false;
    var warn = false;

    if (valid_in_bounds_dates.length == 0 && valid_out_of_bounds_dates.length > 0) {
        date = valid_out_of_bounds_dates[0];
        out_of_bounds = true;
    } else {
        var date = valid_in_bounds_dates[0];
        if (date.isAfter(extrema.warning)) {
            warn = true;
        }
    }
    return {
        white: white,
        black: black,
        date: date,
        warn: warn,
        out_of_bounds: out_of_bounds
    };
}

// Calculate the extrema of the current round for both leagues.
//
// Each league has  slightly different requirements for when your
// game must be played. This method will return the given start datetime
// and end datetime for the round.
//
// Options:
//     extrema.reference_date: If this is provided it the round is guaranteed
//       to include this date. Mostly used for tests.
//     extrema.iso_weekday: The weekday after which games cannot be scheduled.
//     extrema.hour: The hour after which games cannot be scheduled.
//     extrema.hour: The weekday on which the pairings are released.
//     extrema.warning_hours: The amount of hours before the final scheduling
//       cutoff during which we will warn users they are cutting it close.
function get_round_extrema(options) {
    options = options || {};
    extrema = {};
    _.extend(extrema, EXTREMA_DEFAULTS, options.extrema);

    // Get the reference date, which is either today or the reference_date
    // from the options
    if (!extrema.reference_date) {
        round_start = moment.utc();
    } else {
        round_start = moment(extrema.reference_date).clone();
    }
    // Make it the right time of day.
    round_start.hour(extrema.hour).minute(extrema.minute).second(0);

    // find the appropriate weekday
    while (round_start.isoWeekday() != extrema.iso_weekday) {
        round_start.subtract(1, 'days');
    }

    // The end is always 7 days in advance
    var round_end = round_start.clone().add(7, 'days');
    var warning_end = round_end.clone().subtract(extrema.warning_hours, 'hours');
    return {
        'start': round_start,
        'end': round_end,
        'warning': warning_end
    };
}

// get_rows is a client side implementation of the record-type results that we
// got from the row based API. Instead, we now implement this in the following
// manner:
//   1. Query for all cells in a particular range.
//   2. Asssume first row is a header row.
//   3. Turn each subsequent row into an object, of key-values based on the header
//   4. return rows.
function get_rows(service_account_auth, spreadsheet_key, options, callback) {
    var doc = new GoogleSpreadsheet(spreadsheet_key);
    doc.useServiceAccountAuth(service_account_auth, function(err, info) {
        var pairings_sheet = undefined;
        doc.getInfo(function(err, info) {
            if (err) { return callback(err, info); }
            // Find the last spreadsheet with the word "round" in the title.
            // this ought to work for both tournaments
            info.worksheets.forEach(function(sheet) {
                if (sheet.title.toLowerCase().indexOf("round") != -1) {
                    pairings_sheet = sheet;
                }
            });
            if (!pairings_sheet) {
                callback("Unable to find pairings worksheet");
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
            pairings_sheet.getCells(
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
                    var header_row = rows[1];
                    header_row = _.map(header_row, function(item, i) {
                        if (item) {
                            return item.value.toLowerCase();
                        } else {
                            return i;
                        }
                    });
                    var record_rows = [];
                    rows.slice(2).forEach(function(row) {
                        record_rows.push(_.object(_.zip(header_row, row)));
                    });
                    callback(undefined, record_rows);
                }
            );
        });
    });
}

// Finds the given pairing in one of the team spreadsheets
// callback gets three values: error, row, whether the pairing is reversed or not.
function find_pairing(service_account_auth, spreadsheet_key, white, black, callback) {
    var options = {
        'min-col': 1,
        'max-col': 7
    };
    function row_matches_pairing(row) {
        var row_black = row.black.value.toLowerCase();
        var row_white = row.white.value.toLowerCase();
        if (
            (row_black.indexOf(black) != -1 && row_white.indexOf(white) != -1)
        ) {
            return true;
        } else if (
            (row_white.indexOf(black) != -1 && row_black.indexOf(white) != -1)
        ) {
            return true;
        }
        return false;
    }
    get_rows(
        service_account_auth,
        spreadsheet_key,
        options,
        function(err, rows) {
            var rows = _.filter(rows, row_matches_pairing);
            // Only update it if we found an exact match
            if (rows.length > 1) {
                return callback("Unable to find pairing. More than one row was returned!");
            } else if(rows.length < 1) {
                return callback("Unable to find pairing. No rows were returned!");
            }
            var row = rows[0];
            var row_black = row.black.value.toLowerCase();
            var row_white = row.white.value.toLowerCase();
            var reversed = false;
            if (row_white.indexOf(black) != -1) {
                reversed = true
            }
            callback(undefined, row, reversed);
        }
    );
}

// Update the schedule
function update_schedule(service_account_auth, key, colname, format, schedule, callback) {
    var white = schedule.white;
    var black = schedule.black;
    var date = schedule.date;
    find_pairing(service_account_auth, key, white, black, function(err, row, reversed) {
        if (err) {
            return callback(err);
        }
        // This portion is specific to the team tournament
        var schedule_cell = row[colname];
        schedule_cell.value = date.format(format);

        schedule_cell.save(function(err) {
            return callback(err, reversed);
        });
    });
}

// parse the input string for a results update
function parse_result(input_string){
    var tokens = get_tokens_result(input_string);   
    var result = find_result(tokens);
    var players = find_players(tokens);
    
    return {
        "white": players.white,
        "black": players.black,
        "result": result,
    };
}

function get_tokens_result(input_string){
    return input_string.split(" ");
}

function find_result(tokens){
    var result;
    _.some(tokens, function(token){
        return (result = VALID_RESULTS[token.toUpperCase()]) ? true : false;
    });
    return result;
}

function find_players(tokens){
    // in reality, the order is arbitrary.
    // just assuming first I find is white, the second is black
    var players = {};
    
    var player_tokens = filter_player_tokens(tokens);

    //assuming we found 2 tokens, we should convert them to player names
    if(player_tokens.length == 2){
        players.white = player_tokens[0];
        players.black = player_tokens[1];
    }

    return players;
}

function filter_player_tokens(tokens){
    return _.filter(tokens, function(token){
        return /^\<@[A-Z0-9]+\>$/.test(token);
    });
}

//this assumes it is being given a valid result - that is th contract
//error handling for a bad result should happen outside this function
function update_result(service_account_auth, key, colname, result, callback){
    var white = result.white;
    var black = result.black;
    var result = result.result;
    
    find_pairing(
        service_account_auth, 
        key, 
        white.name, 
        black.name, 
        function(err, row, reversed){
            if(err){
                return callback(err);
            }
            var result_cell = row[colname];

            //make the update to the cell
            //parse the links out of the function
            //update only the result - will create a function to update the gamelink
            
            if(reversed){
                //switch the result
               var lhs = result.split('-')[0];
               var rhs = result.split('-')[1];
               result = rhs + '-' + lhs;
            }

            var gamelink = ' ';            

            var formula = result_cell.formula;
            if(formula && formula.toUpperCase().includes("HYPERLINK")){
               gamelink = formula.split("\"")[1];
            }

            result_cell.formula = '=HYPERLINK("' + gamelink + '","' + result + '")';

            result_cell.save(function(err){
                return callback(err, reversed);
            });
        }
    );
}

module.exports.get_round_extrema = get_round_extrema;
module.exports.parse_scheduling = parse_scheduling;
module.exports.parse_result = parse_result;
module.exports.update_schedule = update_schedule;
module.exports.update_result = update_result;
module.exports.ScheduleParsingError = ScheduleParsingError;
module.exports.PairingError = PairingError;
