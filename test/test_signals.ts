import { assert } from 'chai'
import {
    PostedMessage,
    SignalTransport,
    Signals,
    SHUTDOWN_EMOJI,
} from '../src/signals'

interface Post {
    channel: string
    text: string
    threadTs?: string
}

class FakeTransport implements SignalTransport {
    posts: Post[] = []
    reactions: { message: PostedMessage; emoji: string }[] = []
    failPosts = false

    async post(channel: string, text: string, threadTs?: string) {
        if (this.failPosts) {
            throw new Error('slack is down')
        }
        this.posts.push({ channel, text, threadTs })
        return { channel: 'C123', ts: `${this.posts.length}.0` }
    }

    async react(message: PostedMessage, emoji: string) {
        this.reactions.push({ message, emoji })
    }
}

describe('signals', function () {
    it('posts the startup message to the configured channel', async function () {
        const transport = new FakeTransport()
        const signals = new Signals(transport, '#dev-website-and-bot')
        await signals.start('starting')
        assert.deepEqual(transport.posts, [
            {
                channel: '#dev-website-and-bot',
                text: 'starting',
                threadTs: undefined,
            },
        ])
    })

    it('threads later signals under the startup message', async function () {
        const transport = new FakeTransport()
        const signals = new Signals(transport, '#dev-website-and-bot')
        signals.start('starting')
        await signals.emit('connected')
        assert.deepEqual(transport.posts[1], {
            channel: 'C123',
            text: 'connected',
            threadTs: '1.0',
        })
    })

    it('reacts to the startup message on shutdown', async function () {
        const transport = new FakeTransport()
        const signals = new Signals(transport, '#dev-website-and-bot')
        signals.start('starting')
        await signals.shutdown('stopping')
        assert.equal(transport.posts[1].text, 'stopping')
        assert.equal(transport.posts[1].threadTs, '1.0')
        assert.deepEqual(transport.reactions, [
            { message: { channel: 'C123', ts: '1.0' }, emoji: SHUTDOWN_EMOJI },
        ])
    })

    it('stays quiet when there is no startup thread', async function () {
        const transport = new FakeTransport()
        const signals = new Signals(transport, '#dev-website-and-bot')
        await signals.emit('connected')
        await signals.shutdown('stopping')
        assert.isEmpty(transport.posts)
        assert.isEmpty(transport.reactions)
    })

    it('swallows transport failures', async function () {
        const transport = new FakeTransport()
        transport.failPosts = true
        const signals = new Signals(transport, '#dev-website-and-bot')
        assert.isUndefined(await signals.start('starting'))
        await signals.emit('connected')
        assert.isEmpty(transport.posts)
    })
})
