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
var DATE_FORMATS = [
    "YYYYMMDD HHmm",
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
function DateParsingError () {}
DateParsingError.prototype = new Error();
function ScheduleOutOfBounds () {}
ScheduleOutOfBounds.prototype = new Error();
function PairingError () {}
PairingError.prototype = new Error();

// Make an attempt to parse a scheduling string. 
//
// Parameters:
//     input_string: the string to try and parse 
//     options: options for both this method and are passed along to 
//         get_round_extrema options
//     options.warning_hours: an integer specifying how many hours
//         before the round end that we want to warn people about.
function parse_scheduling(input_string, options) {
    // Do some basic preprocessing
    input_string = input_string.replace(/[:@\.,\(\)\<\>]/g, ' ');

    var parts = input_string.split(" ");

    // Filter out word that we know we want to ignore.
    var filtered_parts = [];
    parts.forEach(function(part) {
        // Remove all lone 
        if (WORDS_TO_IGNORE.indexOf(part.toLowerCase()) != -1) {
            return;
        }
        filtered_parts.push(part);
    });
    if (filtered_parts.length < 3) {
        console.log("Unable to parse date: " + input_string);
        throw new DateParsingError();
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

    var valid_in_bounds_dates = [];
    var valid_out_of_bounds_dates = [];
    date_strings.forEach(function(date_string) {
        DATE_FORMATS.forEach(function(format) {
            var date = moment.utc(date_string, format);
            if (!date.isValid()) {
                return;
            }
            valid_out_of_bounds_dates.push(date);
            // TODO: This check will prevent us from publishing pairings
            //       early AND having people announce their schedule early.
            //       Which is unfortunate, but I haven't thought of an elegant
            //       or easy way to allow for this. :/
            if (date.isBefore(extrema.start) || date.isAfter(extrema.end)) {
                return;
            }
            valid_in_bounds_dates.push(date);
        });
    });
    if (valid_in_bounds_dates.length == 0 && valid_out_of_bounds_dates.length == 0) {
        console.log("Unable to parse date: [" + input_string + "]");
        throw new DateParsingError();
    }
    if (valid_in_bounds_dates.length == 0 && valid_out_of_bounds_dates.length > 0) {
        throw new ScheduleOutOfBounds();
    }

    var date = valid_in_bounds_dates[0];

    var warn = false;
    if (date.isAfter(extrema.warning)) {
        warn = true;
    }

    // strip out any punctuation from the usernames
    var white = filtered_parts[0].replace(/[@\.,\(\):]/g, '');
    var black = filtered_parts[1].replace(/[@\.,\(\):]/g, '');
    // return the result
    return {
        white: white,
        black: black,
        date: date,
        warn: warn
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
        'max-col': 6
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

module.exports.get_round_extrema = get_round_extrema;
module.exports.parse_scheduling = parse_scheduling;
module.exports.update_schedule = update_schedule;
module.exports.DateParsingError = DateParsingError;
module.exports.ScheduleOutOfBounds = ScheduleOutOfBounds;
module.exports.PairingError = PairingError;
