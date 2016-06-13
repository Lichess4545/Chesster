var assert = require('chai').assert;
var moment = require("moment");
var spreadsheets = require('../spreadsheets');



var fmt = "YYYY-MM-DDTHH:mm:ssZZ";

describe('scheduling', function() {
    //--------------------------------------------------------------------------
    describe('#getRoundExtrema()', function () {
        var options = {
            "extrema": {
                "isoWeekday": 1,
                "hour": 11,
                "minute": 0,
            }
        };
        it(".isoWeekday() of the bounds should always return the value passed in", function() {
            var bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(1, bounds.start.isoWeekday());
            assert.equal(1, bounds.end.isoWeekday());

            options.extrema.isoWeekday = 2;
            bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(2, bounds.start.isoWeekday());
            assert.equal(2, bounds.end.isoWeekday());
            var now = moment.utc();
            assert.equal(true, now.isAfter(bounds.start));
            assert.equal(true, now.isBefore(bounds.end));
        });
        it("The bounds respects the passed in extrema and reference date", function() {
            options.extrema.isoWeekday = 1;
            options.extrema.referenceDate = moment.utc("2016-04-07");
            var bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(bounds.start.format(fmt), "2016-04-04T11:00:00+0000")
            assert.equal(bounds.end.format(fmt), "2016-04-11T11:00:00+0000")
        });
        it("The round extrema works on day when the rounds change, durng the period leading up to the cutoff", function() {
            options.extrema.isoWeekday = 1;
            options.extrema.referenceDate = moment.utc("2016-05-02T03:55:00");
            var bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(bounds.start.format(fmt), "2016-04-25T11:00:00+0000")
            assert.equal(bounds.end.format(fmt), "2016-05-02T11:00:00+0000")
            options.extrema.referenceDate = moment.utc("2016-05-02T10:59:59");
            bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(bounds.start.format(fmt), "2016-04-25T11:00:00+0000")
            assert.equal(bounds.end.format(fmt), "2016-05-02T11:00:00+0000")
        });
        it("The round extrema works on day when the rounds change, during the period after up to the cutoff", function() {
            options.extrema.isoWeekday = 1;
            options.extrema.referenceDate = moment.utc("2016-05-02T12:55:00");
            var bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(bounds.start.format(fmt), "2016-05-02T11:00:00+0000")
            assert.equal(bounds.end.format(fmt), "2016-05-09T11:00:00+0000")

            options.extrema.referenceDate = moment.utc("2016-05-02T11:00:00");
            bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(bounds.start.format(fmt), "2016-05-02T11:00:00+0000")
            assert.equal(bounds.end.format(fmt), "2016-05-09T11:00:00+0000")
        });
        it("Test warningHours", function() {
            options.extrema.isoWeekday = 1;
            options.extrema.referenceDate = moment.utc("2016-04-07");
            options.extrema.warningHours = 1;
            var bounds = spreadsheets.getRoundExtrema(options);
            assert.equal(bounds.start.format(fmt), "2016-04-04T11:00:00+0000");
            assert.equal(bounds.end.format(fmt), "2016-04-11T11:00:00+0000");
            assert.equal(bounds.warning.format(fmt), "2016-04-11T10:00:00+0000");
        });
    });
    //--------------------------------------------------------------------------
    describe('#parseScheduling()', function () {
        var options = {
            "extrema": {
                "isoWeekday": 1,
                "hour": 22,
                "minute": 0,
                "warningHours": 1
            }
        };
        function testParseScheduling(string, expected)  {
            var results = spreadsheets.parseScheduling(string, options);
            assert.equal(results.date.format(fmt), expected.date);
            assert.equal(results.white, expected.white);
            assert.equal(results.black, expected.black);
        }
        it("Test team-scheduling messages", function() {
            options.extrema.referenceDate = moment.utc("2016-04-15");

            // TODO: put a bunch of the team scheduling message in here.
        });
        it("Test lonewolf-scheduling messages", function() {
            this.timeout(3000);
            //options.extrema.referenceDate = moment.utc("2016-04-15");
            testParseScheduling(
                "@autotelic v @explodingllama 4/16 @ 0900 GMT", {
                    white: "autotelic",
                    black: "explodingllama",
                    date: "2016-04-16T09:00:00+0000"
                }
            );
            testParseScheduling(
                "@adrianchessnow:  v @mydogeatslemons: 4/15 2300 GMT",
                {
                    white: "adrianchessnow",
                    black: "mydogeatslemons",
                    date: "2016-04-15T23:00:00+0000"
                }
            );
            testParseScheduling(
                "@juansnow v @jimcube27 4/17 @ 1030 GMT",
                {
                    white: "juansnow",
                    black: "jimcube27",
                    date: "2016-04-17T10:30:00+0000"
                }
            );
            testParseScheduling(
                "@mrrobot v @ashkanjah 4/16 @ 1400 GMT",
                {
                    white: "mrrobot",
                    black: "ashkanjah",
                    date: "2016-04-16T14:00:00+0000"
                }
            );
            testParseScheduling(
                "@rreyv vs @krzem 4/17 (sunday) 15:00 GMT",
                {
                    white: "rreyv",
                    black: "krzem",
                    date: "2016-04-17T15:00:00+0000"
                }
            );
            testParseScheduling(
                "@atrophied vs @jaivl 4/14 20:00",
                {
                    white: "atrophied",
                    black: "jaivl",
                    date: "2016-04-14T20:00:00+0000"
                }
            );
            testParseScheduling(
                "reschedule @modakshantanu vs @hakonj April 14th 7:00 GMT",
                {
                    white: "modakshantanu",
                    black: "hakonj",
                    date: "2016-04-14T07:00:00+0000"
                }
            );
            testParseScheduling(
                "@quirked vs @vishysoisse 4/14 21:00 GMT",
                {
                    white: "quirked",
                    black: "vishysoisse",
                    date: "2016-04-14T21:00:00+0000"
                }
            );
            testParseScheduling(
                "@theino: vs @cactus 4/14 2:30 gmt",
                {
                    white: "theino",
                    black: "cactus",
                    date: "2016-04-14T02:30:00+0000"
                }
            );
            testParseScheduling(
                "@seb32 vs @ Petruchio 4/15 23:00 GMT.",
                {
                    white: "seb32",
                    black: "Petruchio",
                    date: "2016-04-15T23:00:00+0000"
                }
            );
            testParseScheduling(
                "@soldadofiel vs @durchnachtundwind Wednesday 4/13 23.09 GMT",
                {
                    white: "soldadofiel",
                    black: "durchnachtundwind",
                    date: "2016-04-13T23:09:00+0000"
                }
            );
            testParseScheduling(
                "@greyhawk vs @immortality  thursday 4/14  2100 GMT",
                {
                    white: "greyhawk",
                    black: "immortality",
                    date: "2016-04-14T21:00:00+0000"
                }
            );
            testParseScheduling(
                "@soldadofiel vs @durchnachtundwind Wednesday 4/13 23.09 GMT",
                {
                    white: "soldadofiel",
                    black: "durchnachtundwind",
                    date: "2016-04-13T23:09:00+0000"
                }
            );
            testParseScheduling(
                "@nacional100 vs @tnan123 Friday 4/15 @ 14:00 GMT",
                {
                    white: "nacional100",
                    black: "tnan123",
                    date: "2016-04-15T14:00:00+0000"
                }
            );
            testParseScheduling(
                "hillrp vs @endrawes0  0100 GMT 17/4/16",
                {
                    white: "hillrp",
                    black: "endrawes0",
                    date: "2016-04-17T01:00:00+0000"
                }
            );
            testParseScheduling(
                "@saschlars vs @preserve April 16th at 12:00 GMT",
                {
                    white: "saschlars",
                    black: "preserve",
                    date: "2016-04-16T12:00:00+0000"
                }
            );
            testParseScheduling(
                "reschedule: @modakshantanu  vs @hakonj April 14th @ 15:00 GMT",
                {
                    white: "modakshantanu",
                    black: "hakonj",
                    date: "2016-04-14T15:00:00+0000"
                }
            );
            testParseScheduling(
                "@ihaterbf vs @hyzer 4/16 22:00 GMT",
                {
                    white: "ihaterbf",
                    black: "hyzer",
                    date: "2016-04-16T22:00:00+0000"
                }
            );
            testParseScheduling(
                "@djcrisce vs @zantawb 4/15 00:00 GMT",
                {
                    white: "djcrisce",
                    black: "zantawb",
                    date: "2016-04-15T00:00:00+0000"
                }
            );
            testParseScheduling(
                "@jptriton vs @cyanfish Thurs April 14 @ 18:00 GMT",
                {
                    white: "jptriton",
                    black: "cyanfish",
                    date: "2016-04-14T18:00:00+0000"
                }
            );
            testParseScheduling(
                "@narud vs @lakinwecker 4/16 17:00 GMT",
                {
                    white: "narud",
                    black: "lakinwecker",
                    date: "2016-04-16T17:00:00+0000"
                }
            );
            testParseScheduling(
                "@jyr vs @droodjerky  15/04 at 17:00 GMT",
                {
                    white: "jyr",
                    black: "droodjerky",
                    date: "2016-04-15T17:00:00+0000"
                }
            );
            testParseScheduling(
                "@chill5555 vs @doganof 15/04 at 17:00 GMT",
                {
                    white: "chill5555",
                    black: "doganof",
                    date: "2016-04-15T17:00:00+0000"
                }
            );
            testParseScheduling(
                "@oldtom v @bramminator  04/17 @ 16:15 GMT",
                {
                    white: "oldtom",
                    black: "bramminator",
                    date: "2016-04-17T16:15:00+0000"
                }
            );
            testParseScheduling(
                "@ctorh - @practicedave 18/4@18:00GMT",
                {
                    white: "ctorh",
                    black: "practicedave",
                    date: "2016-04-18T18:00:00+0000"
                }
            );
            testParseScheduling(
                "@boviced v @hoxhound April 14, 16:00 GMT",
                {
                    white: "boviced",
                    black: "hoxhound",
                    date: "2016-04-14T16:00:00+0000"
                }
            );
            testParseScheduling(
                "@pasternak v @riemannn, April 14, 20:00 GMT",
                {
                    white: "pasternak",
                    black: "riemannn",
                    date: "2016-04-14T20:00:00+0000"
                }
            );
            testParseScheduling(
                "@angborxley v @theknug April 17th 13:30 GMT",
                {
                    white: "angborxley",
                    black: "theknug",
                    date: "2016-04-17T13:30:00+0000"
                }
            );
            testParseScheduling(
                "@modakshantanu v @hakonj April 13th 07:00 GMT",
                {
                    white: "modakshantanu",
                    black: "hakonj",
                    date: "2016-04-13T07:00:00+0000"
                }
            );
            testParseScheduling(
                "<@U0DJTJ15W>: vs <@U0YUPPF4H> 04/16/16 00:00 GMT",
                {
                    white: "U0DJTJ15W",
                    black: "U0YUPPF4H",
                    date: "2016-04-16T00:00:00+0000"
                }
            );
            testParseScheduling(
                "<@U0DJTJ15W> (white pieces) vs <@U0YUPPF4H> (Black pieces) Saturday, 4/17 @20:00 GMT",
                {
                    white: "U0DJTJ15W",
                    black: "U0YUPPF4H",
                    date: "2016-04-17T20:00:00+0000"
                }
            );
            testParseScheduling(
                "imakethenews vs. riemannn  4/17 00:00 GMT",
                {
                    white: "imakethenews",
                    black: "riemannn",
                    date: "2016-04-17T00:00:00+0000"
                }
            );
            testParseScheduling(
                "resonantpillow vs steiger07 : sunday 17.04. @ 16:00 GMT",
                {
                    white: "resonantpillow",
                    black: "steiger07",
                    date: "2016-04-17T16:00:00+0000"
                }
            );
            testParseScheduling(
                "supervj: v ecstaticbroccoli Wednesday 19:00 GMT",
                {
                    white: "supervj",
                    black: "ecstaticbroccoli",
                    date: "2016-04-13T19:00:00+0000"
                }
            );
            testParseScheduling(
                "@ronaldulyssesswanson – @esolcneveton on Saturday, April 16th at 14:00 GMT.",
                {
                    white: "ronaldulyssesswanson",
                    black: "esolcneveton",
                    date: "2016-04-16T14:00:00+0000"
                }
            );
            testParseScheduling(
                "@ronaldulyssesswanson – @esolcneveton rescheduled to Sunday, April 17th at 14:00 GMT.",
                {
                    white: "ronaldulyssesswanson",
                    black: "esolcneveton",
                    date: "2016-04-17T14:00:00+0000"
                }
            );
        });
        it("Test lonewolf-scheduling messages #2", function() {
            options.extrema.referenceDate = moment.utc("2016-04-28");
            testParseScheduling(
                "steiger07 vs matuiss2 Sun 01.05.2016 @ 16:00 GMT",
                {
                    white: "steiger07",
                    black: "matuiss2",
                    date: "2016-05-01T16:00:00+0000"
                }
            );
            testParseScheduling(
                "steiger07 vs matuiss2 01.05.2016 @ 16:00 GMT",
                {
                    white: "steiger07",
                    black: "matuiss2",
                    date: "2016-05-01T16:00:00+0000"
                }
            );
            testParseScheduling(
                "@steiger07 vs @matuiss2 5/1 @ 16:00 GMT",
                {
                    white: "steiger07",
                    black: "matuiss2",
                    date: "2016-05-01T16:00:00+0000"
                }
            );
            testParseScheduling(
                "@theknug: vs. @fradtheimpaler Sat. 4/30 at 14:00 GMT",
                {
                    white: "theknug",
                    black: "fradtheimpaler",
                    date: "2016-04-30T14:00:00+0000"
                }
            );
            testParseScheduling(
                "@theknug - @fradtheimpaler saturday 30/4 14 GMT",
                {
                    white: "theknug",
                    black: "fradtheimpaler",
                    date: "2016-04-30T14:00:00+0000"
                }
            );
            testParseScheduling(
                "captncarter vs Kimaga 17.00 GMT 27-04",
                {
                    white: "captncarter",
                    black: "Kimaga",
                    date: "2016-04-27T17:00:00+0000"
                }
            );
        });
        it("Test lonewolf-scheduling messages that are out of bounds", function() {
            var options = {
                "extrema": {
                    referenceDate: moment.utc("2016-04-15"),
                    "isoWeekday": 1,
                    "hour": 22,
                    "minute": 0,
                }
            };
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/19 @ 0900 GMT",
                options
            );
            assert.equal(true, results.outOfBounds);
        });
        it("Test lonewolf-scheduling messages that are out of bounds", function() {
            var options = {
                "extrema": {
                    "referenceDate": moment.utc("2016-04-15"),
                    "isoWeekday": 1,
                    "hour": 22,
                    "minute": 0,
                }
            };
            function testParseScheduling(string)  {
                var results = spreadsheets.parseScheduling(
                    string,
                    options
                );
                assert.equal(true, results.outOfBounds);
            }
            testParseScheduling("@autotelic v @explodingllama 4/19 @ 0900 GMT");
            testParseScheduling("@autotelic v @explodingllama 4/18 @ 2230 GMT");
            testParseScheduling("@autotelic v @explodingllama 4/18 @ 2201 GMT");
            testParseScheduling("narud vs lakinwecker 04/18 @ 23:56 GMT");
        });
        it("Test lonewolf-scheduling messages that are in the warning time-period", function() {
            var options = {
                "extrema": {
                    "referenceDate": moment.utc("2016-04-15"),
                    "isoWeekday": 1,
                    "hour": 22,
                    "minute": 0,
                    "warningHours": 1
                }
            };
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2200 GMT",
                options
            );
            assert.equal(true, results.warn);
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2159 GMT",
                options
            );
            assert.equal(true, results.warn);
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2130 GMT",
                options
            );
            assert.equal(true, results.warn);
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2101 GMT",
                options
            );
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2100 GMT",
                options
            );
            assert.equal(false, results.warn);
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2059 GMT",
                options
            );
            assert.equal(false, results.warn);
            var results = spreadsheets.parseScheduling(
                "@autotelic v @explodingllama 4/18 @ 2030 GMT",
                options
            );
            assert.equal(false, results.warn);
        });
    });
});

describe('gamelinks', function(){
    describe('#parseGamelink', function(){
        it("Tests gamelinks format parsing.", function(){
            function testParseGamelink(string, expected)  {
                var result = spreadsheets.parseGamelink(string);
                assert.equal(result.gamelinkID, expected);
            }
            testParseGamelink(
                "<@U1234567> http://en.lichess.org/H5YNnlR5RqMN",
                "H5YNnlR5RqMN"
            );
            testParseGamelink(
                "http://en.lichess.org/H5YNnlR5RqMN/white",
                "H5YNnlR5RqMN"
            );
            testParseGamelink(
                "http://en.lichess.org/H5YNnlR5RqMN/black",
                "H5YNnlR5RqMN"
            );
            testParseGamelink(
                "some words http://en.lichess.org/H5YNnlR5RqMN and other stuff",
                "H5YNnlR5RqMN"
            );
            testParseGamelink(
                "<en.lichess.org/ClhKGw8s|en.lichess.org/ClhKGw8s>",
                "ClhKGw8s"
            );
            testParseGamelink(
                "there is no link here",
                undefined
            );

        });
    });
});

// we are exposing 2 new functions - parseResult and updateResult
// we cant unit test updateResult becauase it has side effects and depends on the spreadsheet.
// A thorough test of thhose functions would require a lot of setup and tear down or a mock spreadsheet.
// ill stick with the tests for result oarsing.
describe('results', function(){
    describe('#parseResult', function(){
        it("Test result format parsing.", function() {
            //options.extrema.referenceDate = moment.utc("2016-04-15");
            function testParseResult(string, expected)  {
                var result = spreadsheets.parseResult(string);
                assert.equal(result.result, expected.result);
                assert.equal(result.white, expected.white);
                assert.equal(result.black, expected.black);
            }
            testParseResult(
                "<@U1234567> v <@U2345678> 1-0", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "1-0"
                }
            );
            testParseResult(
                "<@U1234567> 0-1 <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "0-1"
                }
            );
            testParseResult(
                "<@U1234567> 0-0 <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "0-0"
                }
            );
            testParseResult(
                "<@U1234567> 0F-1X <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "0F-1X"
                }
            );
            testParseResult(
                "<@U1234567> 1X-0F <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "1X-0F"
                }
            );
            testParseResult(
                "<@U1234567> 1/2Z-1/2Z <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "1/2Z-1/2Z"
                }
            );
            testParseResult(
                "<@U1234567> 0F-0F <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "0F-0F"
                }
            );
            testParseResult(
                "<@U1234567> and <@U2345678> drew", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "1/2-1/2"
                }
            );
            testParseResult(
                "<@U1234567> 0.5-0.5 <@U2345678>", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "1/2-1/2"
                }
            );
            testParseResult(
                "the <@U1234567> and <@U2345678> game was a draw", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: "1/2-1/2"
                }
            );
            testParseResult(
                "this has only one player <@U1234567> and no result", {
                    white: undefined,
                    black: undefined,
                    result: undefined,
                } 
            );
            testParseResult(
                "this has only two players <@U1234567> v <@U2345678> and no result", {
                    white: "<@U1234567>",
                    black: "<@U2345678>",
                    result: undefined,
                }
            );
            testParseResult(
                "this has no players but a result 1-0", {
                    white: undefined,
                    black: undefined,
                    result: "1-0",
                }
            );
        });
    });
});

// Parse a hyperlink
describe('Hyperlink', function(){
    it("Test Hyperlink Parsing.", function() {

        var res = spreadsheets.parseHyperlink('');
        assert.equal(res["text"], "");
        assert.equal(res["href"], "");

        var res = spreadsheets.parseHyperlink('=HYPERLINK("http://en.lichess.org/FwYcks48","1-0")');
        assert.equal(res["text"], "1-0");
        assert.equal(res["href"], "http://en.lichess.org/FwYcks48");

        var res = spreadsheets.parseHyperlink('=HYPERLINK("","1-0")');
        assert.equal(res["text"], "1-0");
        assert.equal(res["href"], "");

        var res = spreadsheets.parseHyperlink('=HYPERLINK("http://en.lichess.org/FwYcks48","")');
        assert.equal(res["text"], "");
        assert.equal(res["href"], "http://en.lichess.org/FwYcks48");

        var res = spreadsheets.parseHyperlink('=HYPERLINK("","")');
        assert.equal(res["text"], "");
        assert.equal(res["href"], "");

    });
});
