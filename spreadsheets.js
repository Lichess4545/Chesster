var moment = require("moment");
var fuzzy_match = require("./fuzzy_match");
var GoogleSpreadsheet = require("google-spreadsheet");

var ISO_TUESDAY = 2;
var DATE_FORMATS = [
    "YYYYMMDD HHmm",
    "YYYYMMDD Hmm",
    "HHmm DDMMYYYY"
];
var WORDS_TO_IGNORE = [
    "",
    "-",
    "–",
    "at",
    "on",
    "gmt",
    "rescheduled",
    "reschedule",
    "reschedule:",
    "to",
    "v",
    "vs",
    "vs.",
    "versus",
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sun",
    "mon",
    "tues",
    "wed",
    "thu",
    "thur",
    "thurs",
    "fri",
    "sat",

    // TODO: yes, this is oddly specific - but unless he changes his username ....
    "steveharwell"
];

// A scheduling error (as opposed to other errors)
function SchedulingError () {}
SchedulingError.prototype = new Error();
function PairingError () {}
PairingError.prototype = new Error();

// Make an attempt to parse a scheduling string. 
//
// first parameter is the string to parse
// second parameter is an options dict specifying the round extrema options
function parse_scheduling(string, options) {
    // Do some basic preprocessing
    string = string.replace(/[@\.,\(\)\<\>]/g, ' ');

    var parts = string.split(" ");

    // Filter it to remove all the noise
    var filtered_parts = [];
    parts.forEach(function(part) {
        // Remove all lone 
        if (WORDS_TO_IGNORE.indexOf(part.toLowerCase()) != -1) {
            return;
        }
        filtered_parts.push(part);
    });
    if (filtered_parts.length < 3) {
        console.log("Unable to parse scheduling string: " + string);
        throw new SchedulingError();
    }

    // Now build up some possible strings and try a bunch of patterns
    // to find a date in our range.
    var extrema = get_round_extrema(options);
    date_string = filtered_parts.slice(2).join(" ");
    date_string = date_string.toLowerCase();
    var date_strings = [];
    date_strings.push(date_string)
    var now = moment.utc();
    year = now.year();
    month = now.month()+1;
    date_strings.push("" + year + "/" + date_string);
    date_strings.push("" + year + "/" + month + "/" + date_string);

    var dates = [];
    date_strings.forEach(function(date_string) {
        DATE_FORMATS.forEach(function(format) {
            var date = moment.utc(date_string, format);
            if (!date.isValid()) {
                return;
            }
            if (date.isBefore(extrema[0]) || date.isAfter(extrema[1])) {
                return;
            }
            dates.push(date);
        });
    });
    if (dates.length < 1) {
        console.log("Couldn't parse date: " + date_strings[0]);
        throw new SchedulingError();
    }

    // strip out any punctuation from the usernames
    var white = filtered_parts[0].replace(/[@\.,\(\):]/g, '');
    var black = filtered_parts[1].replace(/[@\.,\(\):]/g, '');
    // return the result
    return {
        white: white,
        black: black,
        date: dates[0]
    };
}

// Calculate the extrema of the current round for both leagues.
//
// Each league has  slightly different requirements for when your
// game must be played. This method will return the given start datetime
// and end datetime for the round.
//
// Options:
//     reference_date: If this is provided it the round is guaranteed
//       to include this date. Mostly used for tests.
//     offset_hours: if this is provided it is the applied to both the
//       start and end dates to offset it appropriately.
function get_round_extrema(options) {
    options = options || {};

    // Get the reference date, which is either today or the reference_date
    // from the options
    if (!options.reference_date) {
        round_start = moment.utc();
    } else {
        round_start = moment(options.reference_date).clone();
    }

    // find the starting date
    while (round_start.isoWeekday() != ISO_TUESDAY) {
        round_start.subtract(1, 'days');
    }

    // Make it midnight
    round_start.hour(0).minute(0).second(0);
    round_end = round_start.clone().add(7, 'days');

    // If we have an offset apply it so that the bounds are appropriate
    // for the given league.
    if (options.offset_hours) {
        round_start.subtract(options.offset_hours, 'hours');
        round_end.subtract(options.offset_hours, 'hours');
    }
    return [round_start, round_end];
}

function find_pairing(service_account_auth, spreadsheet_key, white, black, callback) {
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
            pairings_sheet.getRows({
                offset: 1,
                limit: 100
            }, function(err, rows) {
                if (err) { return callback(err, rows); }
                var potential_rows = [];
                rows.forEach(function(row) {
                    var row_black = row.black.toLowerCase();
                    var row_white = row.white.toLowerCase();
                    if (
                        (row_black.indexOf(black) != -1 && row_white.indexOf(white) != -1)
                    ) {
                        potential_rows.push([row, false]);
                    } else if (
                        (row_white.indexOf(black) != -1 && row_black.indexOf(white) != -1)
                    ) {
                        potential_rows.push([row, true]);
                    }
                });
                // Only update it if we found an exact match
                if (potential_rows.length > 1) {
                    return callback("Unable to find pairing. More than one row was returned!");
                } else if(potential_rows.length < 1) {
                    return callback("Unable to find pairing. No rows were returned!");
                }
                var row = potential_rows[0][0];
                var reversed = potential_rows[0][1];
                callback(undefined, row, reversed);
            });
        });
    });

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
        row[colname] = date.format(format);

        row.save(function(err) {
            return callback(err, reversed);
        });
    });
}

module.exports.get_round_extrema = get_round_extrema;
module.exports.parse_scheduling = parse_scheduling;
module.exports.update_schedule = update_schedule;
module.exports.SchedulingError = SchedulingError;
module.exports.PairingError = PairingError;
