// -----------------------------------------------------------------------------
// Winston transport implementation that writes log data to a Slack instance
// Based off of work by andy.batchelor on 2/26/14.
// -----------------------------------------------------------------------------

import _ from 'lodash'
import winston from 'winston'
import Transport from 'winston-transport'
import { MESSAGE } from 'triple-beam'
import logform from 'logform'
import { hasKey } from './utils'
import { SlackBot } from './slack'

interface MessageParams {
    channel: string
    username: string
}

const EmojiLookup = {
    debug: ':grey_question:',
    info: ':information_source:',
    warning: ':warning:',
    error: ':interrobang:',
}

export default class Slack extends Transport {
    private messageParams: MessageParams
    constructor(
        public bot: SlackBot,
        public channel: string,
        // public domain: string,
        public username: string,
        public level?: string,
        public handleExceptions?: boolean,
        public silent?: boolean,
        public format?: logform.Format
    ) {
        super({ format, level, silent, handleExceptions })
        this.level = this.level || 'debug'
        this.silent = this.silent || false
        this.handleExceptions = this.silent || false
        this.messageParams = {
            channel: this.channel,
            username: this.username,
        }
    }

    // This is literally the  signature from the docs. :monkas:
    log?(info: any, next: () => void): any {
        setImmediate(() => {
            this.emit('logged', info)
        })

        if (!this.bot) {
            return
        }

        let iconEmoji = ':grey_question:'
        if (this.level && hasKey(EmojiLookup, this.level)) {
            iconEmoji = EmojiLookup[this.level]
        }

        this.bot.say({
            text: `${iconEmoji} [${this.level}] ${info[MESSAGE]}`,
            icon_emoji: iconEmoji,
            ...this.messageParams,
        })

        next()
    }
}

export class LogWithPrefix {
    constructor(public preMatter: string) {}
    info(msg: string) {
        winston.info(`[${this.preMatter}]: ${msg}`)
    }
    debug(msg: string) {
        winston.debug(`[${this.preMatter}]: ${msg}`)
    }
    warn(msg: string) {
        winston.warn(`[${this.preMatter}]: ${msg}`)
    }
    error(msg: string) {
        winston.error(`[${this.preMatter}]: ${msg}`)
    }
}
