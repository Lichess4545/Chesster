import { assert } from 'chai'
import { formatVersionReply } from '../src/commands/version'

describe('version', function () {
    describe('#formatVersionReply()', function () {
        it('formats the running version and a link to its release notes', function () {
            assert.equal(
                formatVersionReply(
                    '1.2.3',
                    'https://github.com/Lichess4545/Chesster'
                ),
                'Chesster v1.2.3 — <https://github.com/Lichess4545/Chesster/releases/tag/v1.2.3|release notes>'
            )
        })
    })
})
