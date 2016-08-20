var assert = require('chai').assert;
var moment = require("moment");
var spreadsheets = require('../src/spreadsheets');

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
