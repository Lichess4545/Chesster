var assert = require('chai').assert;
var moment = require("moment");
var gamelinks = require('../src/gamelinks');



var fmt = "YYYY-MM-DDTHH:mm:ssZZ";
describe('gamelinks', function(){
    describe('#parseGamelink', function(){
        it("Tests gamelinks format parsing.", function(){
            function testParseGamelink(string, expected)  {
                var result = gamelinks.parseGamelink(string);
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

