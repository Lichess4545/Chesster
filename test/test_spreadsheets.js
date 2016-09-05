var assert = require('chai').assert;
var moment = require("moment");
var spreadsheets = require('../src/spreadsheets');

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
