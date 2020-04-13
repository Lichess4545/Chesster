//------------------------------------------------------------------------------
// Winston transport implementation that writes log data to a Slack instance
// Based off of work by andy.batchelor on 2/26/14.
//------------------------------------------------------------------------------

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

let EmojiLookup = {
    debug: ':grey_question:',
    info: ':information_source:',
    warning: ':warning:',
    error: ':interrobang:',
}

export default class Slack extends Transport {
    private message_params: MessageParams
    constructor(
        public bot: SlackBot,
        public channel: string,
        //public domain: string,
        public username: string,
        public format?: logform.Format,
        public level?: string,
        public silent?: boolean,
        public handleExceptions?: boolean
    ) {
        super({ format, level, silent, handleExceptions })
        this.level = this.level || 'debug'
        this.silent = this.silent || false
        this.handleExceptions = this.silent || false
        this.message_params = {
            channel: this.channel,
            username: this.username,
        }
    }

    // TODO: this is literally the  signature from the docs. :monkas:
    log?(info: any, next: () => void): any {
        setImmediate(() => {
            this.emit('logged', info)
        })

        if (!this.bot) {
            return
        }

        let icon_emoji = ':grey_question:'
        if (this.level && hasKey(EmojiLookup, this.level)) {
            icon_emoji = EmojiLookup[this.level]
        }

        this.bot.say({
            text: `${icon_emoji} [${this.level}] ${info[MESSAGE]}`,
            icon_emoji: icon_emoji,
            ...this.message_params,
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
