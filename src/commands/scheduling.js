//------------------------------------------------------------------------------
// Commands and helpers for scheduling games
//------------------------------------------------------------------------------
const moment = require('moment-timezone');
const _ = require("lodash");
const winston = require("winston");
const Q = require("q");

const slack = require('../slack.js');
const heltour = require('../heltour.js');
const subscription = require('./subscription.js');

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
    "utc",
    "utc.",
    "utc:",
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

// A scheduling error (as opposed to other errors)
function ScheduleParsingError () {}
ScheduleParsingError.prototype = new Error();

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
    var month;
    while (!cur.isAfter(extrema.end)) {
        var monthDay = cur.format("MM-DD");
        // Deal with a couple of formats that moment doesn't produce but are used.
        if (_.isEqual(cur.format("dddd"), "Thursday")) {
            dateNameMappings["thurs"] = monthDay;
        } if (_.isEqual(cur.format("dddd"), "Wednesday")) {
            dateNameMappings["weds"] = monthDay;
        }
        dateNameMappings[cur.format("dd").toLowerCase()] = monthDay;
        dateNameMappings[cur.format("ddd").toLowerCase()] = monthDay;
        dateNameMappings[cur.format("dddd").toLowerCase()] = monthDay;
        dateNameMappings[cur.format("Do").toLowerCase()] = cur.format("DD");
        month = cur.format("MM");
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
    var year = now.format("YYYY");
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
        winston.error("Unable to parse date: " + inputString);
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
        winston.error("Unable to parse date: [" + inputString + "]");
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
    var extrema = {};
    _.extend(extrema, EXTREMA_DEFAULTS, options.extrema);

    // Get the reference date, which is either today or the referenceDate
    // from the options
    var roundStart;
    if (!extrema.referenceDate) {
        roundStart = moment.utc();
    } else {
        roundStart = moment(extrema.referenceDate).clone();
    }
    var referenceDate = roundStart.clone();
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

// There is not active round
function replyNoActiveRound(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " There is currently no active round. If this is a mistake, contact a mod");
}

// Can't find the pairing
function schedulingReplyMissingPairing(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " I couldn't find your pairing. Please use a format like: @white v @black 04/16 @ 16:00");
}

// you are very close to the cutoff
function schedulingReplyTooCloseToCutoff(bot, message, schedulingOptions, white, black) {
    bot.reply(message, 
        ":heavy_exclamation_mark: @" + white.name + " @" + black.name + " " + schedulingOptions.warningMessage
    );
}


// the pairing is ambiguous
function schedulingReplyAmbiguous(bot, message){
    bot.reply(message, 
        "The pairing you are trying to schedule is ambiguous. Please contact a moderator."
    );
}

// Game has been scheduled.
function schedulingReplyScheduled(bot, message, results, white, black) {
    var whiteDate = results.date.clone().tz(white.tz);
    var blackDate = results.date.clone().tz(black.tz);
    var format = "YYYY-MM-DD @ HH:mm UTC";
    var friendly_format = "ddd @ HH:mm";
    var dates = [
        results.date.format(format) + " ",
        whiteDate.format(friendly_format) + " for " + white.name,
        blackDate.format(friendly_format) + " for " + black.name
    ];
    var date_formats  = dates.join("\n\t");

    bot.reply(message, 
        ":heavy_check_mark: @" + white.name + " (_white pieces_) vs @" + black.name + " (_black pieces_) scheduled for: \n\t" + date_formats
    );
}

// Your game is out of bounds
function schedulingReplyTooLate(bot, message, schedulingOptions) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " " + schedulingOptions.lateMessage);
}

// can't find the users you menteiond
function schedulingReplyCantScheduleOthers(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " you may not schedule games for other people. You may only schedule your own games.");
}

// can't find the users you menteiond
function schedulingReplyCantFindUser(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " I don't recognize one of the players you mentioned.");
}


function ambientScheduling(bot, message) {
    var deferred = Q.defer();
    if(!message.league){
        return;
    }

    var schedulingOptions = message.league.options.scheduling;
    var channel = slack.channels.byId[message.channel];
    if (!channel) {
        return;
    }
    if (!_.isEqual(channel.name, schedulingOptions.channel)) {
        deferred.resolve();
        return deferred.promise;
    }

    if (!schedulingOptions) {
        winston.error("[SCHEDULING] {} league doesn't have scheduling options!?".format(message.league.options.name));
        deferred.resolve();
        return deferred.promise;
    } 

    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("[SCHEDULING] {} league doesn't have heltour options!?".format(message.league.options.name));
        deferred.resolve();
        return deferred.promise;
    } 

    var referencesSlackUsers = false;

    var schedulingResults = {
        white: '',
        black: ''
    };

    // Step 1. See if we can parse the dates
    try {
        schedulingResults = parseScheduling(message.text, schedulingOptions);
    } catch (e) {
        if (!(e instanceof (ScheduleParsingError))) {
            throw e; // let others bubble up
        } else {
            winston.debug("[SCHEDULING] Received an exception: {}".format(JSON.stringify(e)));
            winston.debug("[SCHEDULING] Stack: {}".format(e.stack));
        }
        return;
    }

    // Step 2. See if we have valid named players
    var white = slack.users.getByNameOrID(schedulingResults.white);
    var black = slack.users.getByNameOrID(schedulingResults.black);
    if (white && black) {
        schedulingResults.white = white.name;
        schedulingResults.black = black.name;
        referencesSlackUsers = true;
    }

    if (!referencesSlackUsers) {
        schedulingReplyCantFindUser(bot, message);
        return;
    }

    var speaker = slack.users.getByNameOrID(message.user);
    if (
        !_.isEqual(white.id, speaker.id) &&
        !_.isEqual(black.id, speaker.id) &&
        !message.player.isModerator()
    ) {
        schedulingReplyCantScheduleOthers(bot, message); return;
    }

    winston.debug("[SCHEDULING] Attempting to update the website.");
    // Step 3. attempt to update the website
    heltour.updateSchedule(
        heltourOptions,
        schedulingResults
    ).then(function(response) {
        var updateScheduleResults = response['json'];
        if (updateScheduleResults['updated'] === 0) {
            if (updateScheduleResults['error'] === 'not_found') {
                schedulingReplyMissingPairing(bot, message);
                deferred.resolve();
            } else if (updateScheduleResults['error'] === 'no_data') {
                replyNoActiveRound(bot, message);
                deferred.resolve();
            } else if (updateScheduleResults['error'] === 'ambiguous') {
                schedulingReplyAmbiguous(bot, message);
                deferred.resolve();
            } else {
                bot.reply(message, "Something went wrong. Notify a mod");
                deferred.reject("Error updating schedule: " + JSON.stringify(updateScheduleResults));
            }
            return;
        }
        if (updateScheduleResults['reversed']) {
            var tmp = white;
            white = black;
            black = tmp;
        }

        if (schedulingResults.outOfBounds) {
            schedulingReplyTooLate(bot, message, schedulingOptions);
            return;
        }
        if (schedulingResults.warn) {
            schedulingReplyTooCloseToCutoff(bot, message, schedulingOptions, white, black);
        }
        
        var leagueName = message.league.options.name;
        schedulingReplyScheduled(bot, message, schedulingResults, white, black);
        // TODO: test this.
        subscription.emitter.emit('a-game-is-scheduled',
            message.league,
            [white.name, black.name],
            {
                'result': schedulingResults,
                'white': white,
                'black': black,
                'leagueName': leagueName
            }
        );
        deferred.resolve();
    });
    return deferred.promise;
}

module.exports.getRoundExtrema = getRoundExtrema;
module.exports.parseScheduling = parseScheduling;
module.exports.ScheduleParsingError = ScheduleParsingError;
module.exports.ambientScheduling = ambientScheduling;
