import { LogWithPrefix } from './logging'
import { SlackBot } from './slack'
import { formatError } from './utils'

export interface PostedMessage {
    channel: string
    ts: string
}

export interface SignalTransport {
    post(
        channel: string,
        text: string,
        threadTs?: string
    ): Promise<PostedMessage | undefined>
    react(message: PostedMessage, emoji: string): Promise<void>
}

export function slackTransport(bot: SlackBot): SignalTransport {
    return {
        async post(channel, text, threadTs) {
            const response = await bot.say({
                channel,
                text,
                thread_ts: threadTs,
            })
            if (response?.ok && response.channel && response.ts) {
                return { channel: response.channel, ts: response.ts }
            }
            return undefined
        },
        async react(message, emoji) {
            await bot.web.reactions.add({
                channel: message.channel,
                timestamp: message.ts,
                name: emoji,
            })
        },
    }
}

export const SHUTDOWN_EMOJI = 'octagonal_sign'

export class Signals {
    private log = new LogWithPrefix('Signals')
    private thread: Promise<PostedMessage | undefined> =
        Promise.resolve(undefined)

    constructor(
        private transport: SignalTransport,
        private channel: string
    ) {}

    start(text: string): Promise<PostedMessage | undefined> {
        this.thread = this.attempt(() =>
            this.transport.post(this.channel, text)
        )
        return this.thread
    }

    async emit(text: string): Promise<void> {
        const thread = await this.thread
        if (!thread) {
            return
        }
        await this.attempt(() =>
            this.transport.post(thread.channel, text, thread.ts)
        )
    }

    async shutdown(text: string): Promise<void> {
        const thread = await this.thread
        if (!thread) {
            return
        }
        await this.attempt(() =>
            this.transport.post(thread.channel, text, thread.ts)
        )
        await this.attempt(() => this.transport.react(thread, SHUTDOWN_EMOJI))
    }

    private async attempt<T>(action: () => Promise<T>): Promise<T | undefined> {
        try {
            return await action()
        } catch (error) {
            this.log.warn(`Unable to send signal: ${formatError(error)}`)
            return undefined
        }
    }
}
