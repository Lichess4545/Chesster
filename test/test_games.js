var assert = require('chai').assert;
var moment = require("moment-timezone");
var games = require('../src/commands/games');

var fmt = "YYYY-MM-DDTHH:mm:ssZZ";

// we are exposing 2 new functions - parseResult and updateResult
// we cant unit test updateResult becauase it has side effects and depends on the spreadsheet.
// A thorough test of thhose functions would require a lot of setup and tear down or a mock spreadsheet.
// ill stick with the tests for result oarsing.
describe('games', function(){
    describe('#parseResult', function(){
        it("Test result format parsing.", function() {
            //options.extrema.referenceDate = moment.utc("2016-04-15");
            function testParseResult(string, expected)  {
                var result = games.parseResult(string);
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

    describe('#parseGamelink', function(){
        it("Tests gamelinks format parsing.", function(){
            function testParseGamelink(string, expected)  {
                var result = games.parseGamelink(string);
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
    
    describe('#validateGameDetails', function(){
        it("Tests game details validation.", function(){
            var testLeagueOptions = {
                "gamelinks": {
                    "clock": {
                        "initial": 45,
                        "increment": 45
                    },
                    "rated": true,
                    "variant" : "standard",
                    "extrema": {
                        "iso_weekday": 1,
                        "hour": 11,
                        "minute": 0,
                        "warning_hours": 1,
                        "referenceDate": moment("2016-10-16T12:00:00Z")
                    }
                }
            };
            var mockLeague = { options: testLeagueOptions, findPairing: function() { return this._pairings; }};
            function testValidateGameDetails(details, pairings, expected)  {
                mockLeague._pairings = pairings;
                var result = games.validateGameDetails(mockLeague, details);
                for (var prop in expected) {
                    assert.equal(result[prop], expected[prop], "result." + prop);
                }
            }
            testValidateGameDetails(
                {"id":"gVbuwhK3","rated":true,"variant":"standard","speed":"classical","perf":"classical","createdAt":1476567724919,"status":35,"clock":{"initial": 2700, "increment": 45},"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [{white:"happy0", black: "tephra"}],
                {valid: true}
            );
            testValidateGameDetails(
                {"id":"gVbuwhK3","rated":true,"variant":"standard","speed":"classical","perf":"classical","createdAt":1476567724919,"status":35,"clock":{"initial": 2700, "increment": 45},"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [],
                {valid: false, pairingWasNotFound: true, reason: "the pairing was not found."}
            );
            testValidateGameDetails(
                {"id":"gVbuwhK3","rated":true,"variant":"standard","speed":"classical","perf":"classical","createdAt":1476567724919,"status":35,"clock":{"initial": 2700, "increment": 45},"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [{white:"tephra", black: "happy0"}],
                {valid: false, colorsAreReversed: true, reason: "the colors are reversed."}
            );
            testValidateGameDetails(
                {"id":"gVbuwhK3","rated":false,"variant":"standard","speed":"classical","perf":"classical","createdAt":1476567724919,"status":35,"clock":{"initial": 2700, "increment": 45},"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [{white:"happy0", black: "tephra"}],
                {valid: false, gameIsUnrated: true, reason: "the game is unrated."}
            );
            testValidateGameDetails(
                {"id":"gVbuwhK4","rated":true,"variant":"standard","speed":"correspondence","perf":"correspondence","createdAt":1476567724919,"status":35,"daysPerTurn":5,"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [{white:"happy0", black: "tephra"}],
                {valid: false, timeControlIsIncorrect: true, reason: "the time control is incorrect."}
            );
            testValidateGameDetails(
                {"id":"gVbuwhK3","rated":true,"variant":"chess960","speed":"classical","perf":"classical","createdAt":1476567724919,"status":35,"clock":{"initial": 2700, "increment": 45},"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [{white:"happy0", black: "tephra"}],
                {valid: false, variantIsIncorrect: true, reason: "the variant should be standard."}
            );
            testValidateGameDetails(
                {"id":"gVbuwhK3","rated":true,"variant":"standard","speed":"classical","perf":"classical","createdAt":1477567724919,"status":35,"clock":{"initial": 2700, "increment": 45},"players":{"white":{"userId":"happy0","rating":1680},"black":{"userId":"tephra","rating":1418}}},
                [{white:"happy0", black: "tephra"}],
                {valid: false, gameOutsideOfCurrentRound: true, reason: "the game was not played in the current round."}
            );
        });
    });
});
