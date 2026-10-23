import { assert } from 'chai'
import { formatDuration, formatUptimeReply } from '../src/commands/uptime'

describe('uptime', function () {
    describe('#formatDuration()', function () {
        it('lists days down to seconds without weeks', function () {
            assert.equal(
                formatDuration(15 * 86400 + 4 * 3600 + 12 * 60 + 7),
                '15 days, 4 hours, 12 minutes and 7 seconds'
            )
        })
        it('drops units that are zero', function () {
            assert.equal(formatDuration(86400 + 5), '1 day and 5 seconds')
        })
        it('rounds away fractional seconds', function () {
            assert.equal(formatDuration(61.4), '1 minute and 1 second')
        })
    })
    describe('#formatUptimeReply()', function () {
        it('wraps the duration in a sentence', function () {
            assert.equal(
                formatUptimeReply(90),
                'I have been up for 1 minute and 30 seconds.'
            )
        })
    })
})
