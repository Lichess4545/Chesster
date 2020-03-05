//------------------------------------------------------------------------------
// Winston transport implementation that writes log data to a Slack instance
// Based off of work by andy.batchelor on 2/26/14.
//------------------------------------------------------------------------------

import _ from "lodash";
import Transport from "winston-transport";
import {MESSAGE} from "triple-beam";
import logform from "logform";
import {hasKey} from "./utils";

interface MessageParams {
    channel: String
    username: String
}

type EmojiLookup = {
    debug: ":grey_question:"
    info: ":information_source:"
    warning: ":warning:"
    error: ":interrobang:"
}


export default class Slack extends Transport {
    private message_params: MessageParams;
    private emoji_lookup: EmojiLookup;
    constructor(
        public controller: any, // TODO: type this
        public channel: String,
        //public domain: String,
        public username?: String,
        public format?: logform.Format,
        public level?: string,
        public silent?: boolean,
        public handleExceptions?: boolean
    ) {
        super({format, level, silent, handleExceptions});
        this.level = this.level || "debug";
        this.silent = this.silent || false;
        this.handleExceptions = this.silent || false;
        this.message_params = {
            channel: this.channel,
            username: this.username
        };
    }

    // TODO: this is literally the  signature from the docs. :monkas:
    log?(info: any, next: () => void): any {
        setImmediate(() => {this.emit('logged', info);});

        if (!this.controller.bot) {return;}

        let icon_emoji = ":grey_question:";
        if (hasKey(this.emoji_lookup, this.level)) {
            icon_emoji = this.emoji_lookup[this.level];
        }

        this.controller.bot.say({
            text: `${icon_emoji} [${this.level}] ${info[MESSAGE]}`,
            icon_emoji: icon_emoji,
            ...this.message_params
        });

        next();
    }
}
