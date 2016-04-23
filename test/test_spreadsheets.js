var assert = require('chai').assert;
var moment = require("moment");
var spreadsheets = require('../spreadsheets');

describe('scheduling', function() {
    //--------------------------------------------------------------------------
    describe('#get_round_extrema()', function () {
        var options = {
            "extrema": {
                "iso_weekday": 1,
                "hour": 11,
                "minute": 0,
            }
        };
        it(".isoWeekday() of the bounds should always return the value passed in", function() {
            var bounds = spreadsheets.get_round_extrema(options);
            assert.equal(1, bounds.start.isoWeekday());
            assert.equal(1, bounds.end.isoWeekday());

            options.extrema.iso_weekday = 2;
            bounds = spreadsheets.get_round_extrema(options);
            assert.equal(2, bounds.start.isoWeekday());
            assert.equal(2, bounds.end.isoWeekday());
            var now = moment.utc();
            assert.equal(true, now.isAfter(bounds.start));
            assert.equal(true, now.isBefore(bounds.end));
        });
        it("The bounds respects the passed in extrama and reference date", function() {
            options.extrema.iso_weekday = 1;
            options.extrema.reference_date = moment.utc("2016-04-07");
            var bounds = spreadsheets.get_round_extrema(options);
            assert.equal(bounds.start.format(), "2016-04-04T11:00:00+00:00")
            assert.equal(bounds.end.format(), "2016-04-11T11:00:00+00:00")
        });
        it("Test warning_hours", function() {
            options.extrema.iso_weekday = 1;
            options.extrema.reference_date = moment.utc("2016-04-07");
            options.extrema.warning_hours = 1;
            var bounds = spreadsheets.get_round_extrema(options);
            assert.equal(bounds.start.format(), "2016-04-04T11:00:00+00:00");
            assert.equal(bounds.end.format(), "2016-04-11T11:00:00+00:00");
            assert.equal(bounds.warning.format(), "2016-04-11T10:00:00+00:00");
        });
    });
    //--------------------------------------------------------------------------
    describe('#parse_scheduling()', function () {
        var options = {
            "extrema": {
                "iso_weekday": 1,
                "hour": 22,
                "minute": 0,
                "warning_hours": 1
            }
        };
        it("Test team-scheduling messages", function() {
            options.extrema.reference_date = moment.utc("2016-04-15");

            // TODO: put a bunch of the team scheduling message in here.
        });
        it("Test lonewolf-scheduling messages", function() {
            //options.extrema.reference_date = moment.utc("2016-04-15");
            function test_parse_scheduling(string, expected)  {
                var results = spreadsheets.parse_scheduling(string, options);
                assert.equal(results.date.format(), expected.date);
                assert.equal(results.white, expected.white);
                assert.equal(results.black, expected.black);
            }
            test_parse_scheduling(
                "@autotelic v @explodingllama 4/16 @ 0900 GMT", {
                    white: "autotelic",
                    black: "explodingllama",
                    date: "2016-04-16T09:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@ronaldulyssesswanson – @esolcneveton rescheduled to Sunday, April 17th at 14:00 GMT.",
                {
                    white: "ronaldulyssesswanson",
                    black: "esolcneveton",
                    date: "2016-04-17T14:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@adrianchessnow:  v @mydogeatslemons: 4/15 2300 GMT",
                {
                    white: "adrianchessnow",
                    black: "mydogeatslemons",
                    date: "2016-04-15T23:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@juansnow v @jimcube27 4/17 @ 1030 GMT",
                {
                    white: "juansnow",
                    black: "jimcube27",
                    date: "2016-04-17T10:30:00+00:00"
                }
            );
            test_parse_scheduling(
                "@mrrobot v @ashkanjah 4/16 @ 1400 GMT",
                {
                    white: "mrrobot",
                    black: "ashkanjah",
                    date: "2016-04-16T14:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@ronaldulyssesswanson – @esolcneveton on Saturday, April 16th at 14:00 GMT.",
                {
                    white: "ronaldulyssesswanson",
                    black: "esolcneveton",
                    date: "2016-04-16T14:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@rreyv vs @krzem 4/17 (sunday) 15:00 GMT",
                {
                    white: "rreyv",
                    black: "krzem",
                    date: "2016-04-17T15:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@atrophied vs @jaivl 4/14 20:00",
                {
                    white: "atrophied",
                    black: "jaivl",
                    date: "2016-04-14T20:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "reschedule @modakshantanu vs @hakonj April 14th 7:00 GMT",
                {
                    white: "modakshantanu",
                    black: "hakonj",
                    date: "2016-04-14T07:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@quirked vs @vishysoisse 4/14 21:00 GMT",
                {
                    white: "quirked",
                    black: "vishysoisse",
                    date: "2016-04-14T21:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@theino: vs @cactus 4/14 2:30 gmt",
                {
                    white: "theino",
                    black: "cactus",
                    date: "2016-04-14T02:30:00+00:00"
                }
            );
            test_parse_scheduling(
                "@seb32 vs @ Petruchio 4/15 23:00 GMT.",
                {
                    white: "seb32",
                    black: "Petruchio",
                    date: "2016-04-15T23:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@soldadofiel vs @durchnachtundwind Wednesday 4/13 23.09 GMT",
                {
                    white: "soldadofiel",
                    black: "durchnachtundwind",
                    date: "2016-04-13T23:09:00+00:00"
                }
            );
            test_parse_scheduling(
                "@greyhawk vs @immortality  thursday 4/14  2100 GMT",
                {
                    white: "greyhawk",
                    black: "immortality",
                    date: "2016-04-14T21:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@soldadofiel vs @durchnachtundwind Wednesday 4/13 23.09 GMT",
                {
                    white: "soldadofiel",
                    black: "durchnachtundwind",
                    date: "2016-04-13T23:09:00+00:00"
                }
            );
            test_parse_scheduling(
                "@nacional100 vs @tnan123 Friday 4/15 @ 14:00 GMT",
                {
                    white: "nacional100",
                    black: "tnan123",
                    date: "2016-04-15T14:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "hillrp vs @endrawes0  0100 GMT 17/4/16",
                {
                    white: "hillrp",
                    black: "endrawes0",
                    date: "2016-04-17T01:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@saschlars vs @preserve April 16th at 12:00 GMT",
                {
                    white: "saschlars",
                    black: "preserve",
                    date: "2016-04-16T12:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "reschedule: @modakshantanu  vs @hakonj April 14th @ 15:00 GMT",
                {
                    white: "modakshantanu",
                    black: "hakonj",
                    date: "2016-04-14T15:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@ihaterbf vs @hyzer 4/16 22:00 GMT",
                {
                    white: "ihaterbf",
                    black: "hyzer",
                    date: "2016-04-16T22:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@djcrisce vs @zantawb 4/15 00:00 GMT",
                {
                    white: "djcrisce",
                    black: "zantawb",
                    date: "2016-04-15T00:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@jptriton vs @cyanfish Thurs April 14 @ 18:00 GMT",
                {
                    white: "jptriton",
                    black: "cyanfish",
                    date: "2016-04-14T18:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@narud vs @lakinwecker 4/16 17:00 GMT",
                {
                    white: "narud",
                    black: "lakinwecker",
                    date: "2016-04-16T17:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@jyr vs @droodjerky  15/04 at 17:00 GMT",
                {
                    white: "jyr",
                    black: "droodjerky",
                    date: "2016-04-15T17:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@chill5555 vs @doganof 15/04 at 17:00 GMT",
                {
                    white: "chill5555",
                    black: "doganof",
                    date: "2016-04-15T17:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@oldtom v @bramminator  04/17 @ 16:15 GMT",
                {
                    white: "oldtom",
                    black: "bramminator",
                    date: "2016-04-17T16:15:00+00:00"
                }
            );
            test_parse_scheduling(
                "@ctorh - @practicedave 18/4@18:00GMT",
                {
                    white: "ctorh",
                    black: "practicedave",
                    date: "2016-04-18T18:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@boviced v @hoxhound April 14, 16:00 GMT",
                {
                    white: "boviced",
                    black: "hoxhound",
                    date: "2016-04-14T16:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@pasternak v @riemannn, April 14, 20:00 GMT",
                {
                    white: "pasternak",
                    black: "riemannn",
                    date: "2016-04-14T20:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@angborxley v @theknug April 17th 13:30 GMT",
                {
                    white: "angborxley",
                    black: "theknug",
                    date: "2016-04-17T13:30:00+00:00"
                }
            );
            test_parse_scheduling(
                "@imakethenews v. @daveyjones01  April 15, 22:00 GMT, 18:00 EDT",
                {
                    white: "imakethenews",
                    black: "daveyjones01",
                    date: "2016-04-15T22:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@imakethenews v. @daveyjones01  April 15, 22:00 GMT, 18:00 EDT",
                {
                    white: "imakethenews",
                    black: "daveyjones01",
                    date: "2016-04-15T22:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "@modakshantanu v @hakonj April 13th 07:00 GMT",
                {
                    white: "modakshantanu",
                    black: "hakonj",
                    date: "2016-04-13T07:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "osskjc vs Stoy Fri. 15th 8:00 GMT.",
                {
                    white: "osskjc",
                    black: "Stoy",
                    date: "2016-04-15T08:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "<@U0DJTJ15W>: vs <@U0YUPPF4H> 04/16/16 00:00 GMT",
                {
                    white: "U0DJTJ15W",
                    black: "U0YUPPF4H",
                    date: "2016-04-16T00:00:00+00:00"
                }
            );
            test_parse_scheduling(
                "<@U0DJTJ15W> (white pieces) vs <@U0YUPPF4H> (Black pieces) Saturday, 4/17 @20:00 GMT",
                {
                    white: "U0DJTJ15W",
                    black: "U0YUPPF4H",
                    date: "2016-04-17T20:00:00+00:00"
                }
            );
        });
        it("Test lonewolf-scheduling messages that are out of bounds", function() {
            var options = {
                "extrema": {
                    reference_date: moment.utc("2016-04-15"),
                    "iso_weekday": 1,
                    "hour": 22,
                    "minute": 0,
                }
            };
            try {
                var results = spreadsheets.parse_scheduling(
                    "@autotelic v @explodingllama 4/19 @ 0900 GMT",
                    options
                );
                assert.fail("The date should be considered out of bounds!");
            } catch (e) {
                if (e instanceof (spreadsheets.ScheduleOutOfBounds)) {
                    // Good!
                } else {
                    assert.fail("Fail!");
                }
            }
        });
        it("Test lonewolf-scheduling messages that are out of bounds", function() {
            var options = {
                "extrema": {
                    "reference_date": moment.utc("2016-04-15"),
                    "iso_weekday": 1,
                    "hour": 22,
                    "minute": 0,
                }
            };
            function test_parse_scheduling(string)  {
                try {
                    var results = spreadsheets.parse_scheduling(
                        string,
                        options
                    );
                    assert.fail("The date should be considered out of bounds!");
                } catch (e) {
                    if (e instanceof (spreadsheets.ScheduleOutOfBounds)) {
                        // Good!
                    } else {
                        assert.fail("Fail: " + e.stack);
                    }
                }
            }
            test_parse_scheduling("@autotelic v @explodingllama 4/19 @ 0900 GMT");
            test_parse_scheduling("@autotelic v @explodingllama 4/18 @ 2230 GMT");
            test_parse_scheduling("@autotelic v @explodingllama 4/18 @ 2201 GMT");
            test_parse_scheduling("narud vs lakinwecker 04/18 @ 23:56 GMT");
        });
        it("Test lonewolf-scheduling messages that are in the warning time-period", function() {
            var options = {
                "extrema": {
                    "reference_date": moment.utc("2016-04-15"),
                    "iso_weekday": 1,
                    "hour": 22,
                    "minute": 0,
                    "warning_hours": 1
                }
            };
            function test_parse_scheduling(string, expected)  {
                assert.equal(results.date.format(), expected.date);
                assert.equal(results.white, expected.white);
                assert.equal(results.black, expected.black);
            }
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2200 GMT",
                options
            );
            assert.equal(true, results.warn);
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2159 GMT",
                options
            );
            assert.equal(true, results.warn);
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2130 GMT",
                options
            );
            assert.equal(true, results.warn);
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2101 GMT",
                options
            );
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2100 GMT",
                options
            );
            assert.equal(false, results.warn);
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2059 GMT",
                options
            );
            assert.equal(false, results.warn);
            var results = spreadsheets.parse_scheduling(
                "@autotelic v @explodingllama 4/18 @ 2030 GMT",
                options
            );
            assert.equal(false, results.warn);
        });
    });
});


