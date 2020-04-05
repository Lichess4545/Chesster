//------------------------------------------------------------------------------
// Commands related to league information
//------------------------------------------------------------------------------
import { SlackBot, CommandMessage } from '../slack'
import { League } from '../league'

// A helper for a very common pattern
type FormatFn = (l: League) => string
export function directResponse(fn: FormatFn) {
    return function (bot: SlackBot, message: CommandMessage) {
        if (!message.league) return // TODO: figure out a type safe way to get rid of this
        let msg = fn(message.league)
        bot.reply(message, msg)
    }
}

// A helper for a very common pattern
export function dmResponse(fn: FormatFn) {
    return function (bot: SlackBot, message: CommandMessage) {
        if (!message.league) return
        let msg = fn(message.league)
        return new Promise(async (resolve, _) => {
            let convo = await bot.startPrivateConversation([message.user])
            bot.say({ text: msg, channel: convo.channel.id })
            resolve()
        })
    }
}
