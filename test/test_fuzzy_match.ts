import { assert } from 'chai'
import { rankChoices } from '../src/fuzzy_match'

describe('fuzzy_match', function () {
    describe('#rankChoices()', function () {
        it("should return ['asdf'] when searching for 'asdf' in ['asdf', 'boo']", function () {
            var results = rankChoices('asdf', ['asdf', 'boo'])
            assert.equal(1, results.length)
            assert.equal('asdf', results[0].value)
        })
        it("should return ['asdf1', 'asdf2'] when searching for 'asdf' in ['asdf1', 'boo', 'asdf2']", function () {
            var results = rankChoices('asdf', ['asdf1', 'boo', 'asdf2'])
            assert.equal(2, results.length)
            assert.equal('asdf1', results[0].value)
            assert.equal('asdf2', results[1].value)
        })
    })
})
