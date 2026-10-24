import { assert } from 'chai'
import { USER_AGENT, userAgent, withUserAgent } from '../src/http'

describe('http', function () {
    describe('#userAgent()', function () {
        it('names chesster, its version and where to find it', function () {
            assert.equal(
                userAgent('1.4.0'),
                'Chesster/1.4.0 (+https://github.com/Lichess4545/Chesster)'
            )
        })
    })
    describe('#withUserAgent()', function () {
        it('adds the user agent when there are no headers', function () {
            assert.deepEqual(withUserAgent({ path: '/x' }), {
                path: '/x',
                headers: { 'User-Agent': USER_AGENT },
            })
        })
        it('keeps the other headers', function () {
            assert.deepEqual(
                withUserAgent({ headers: { Accept: 'application/json' } })
                    .headers,
                { Accept: 'application/json', 'User-Agent': USER_AGENT }
            )
        })
        it('replaces any user agent the caller set', function () {
            assert.equal(
                withUserAgent({ headers: { 'User-Agent': 'node' } }).headers?.[
                    'User-Agent'
                ],
                USER_AGENT
            )
        })
    })
})
