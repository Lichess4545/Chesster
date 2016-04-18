var assert = require('chai').assert;
var fuzzy_match = require('../fuzzy_match');

describe('fuzzy_match', function() {
    describe('#rank_choices()', function () {
        it("should return ['asdf'] when searching for 'asdf' in ['asdf', 'boo']", function() {
            var results = fuzzy_match.rank_choices('asdf', ['asdf', 'boo']);
            assert.equal(1, results.length);
            assert.equal('asdf', results[0]);
        });
        it("should return ['asdf1', 'asdf2'] when searching for 'asdf' in ['asdf1', 'boo', 'asdf2']", function() {
            var results = fuzzy_match.rank_choices('asdf', ['asdf1', 'boo', 'asdf2']);
            assert.equal(2, results.length);
            assert.equal('asdf1', results[0]);
            assert.equal('asdf2', results[1]);
        });
    });
});


