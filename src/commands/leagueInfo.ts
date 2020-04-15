// -----------------------------------------------------------------------------
// Commands related to league information
// -----------------------------------------------------------------------------
import { SlackBot, CommandMessage } from '../slack'
import { League } from '../league'

// A helper for a very common pattern
type FormatFn = (l: League) => string
export function directResponse(fn: FormatFn) {
    return (bot: SlackBot, message: CommandMessage) => {
        if (!message.league) return // TODO: figure out a type safe way to get rid of this
        const msg = fn(message.league)
        bot.reply(message, msg)
    }
}

// A helper for a very common pattern
export function dmResponse(fn: FormatFn) {
    return (bot: SlackBot, message: CommandMessage) => {
        if (!message.league) return
        const msg = fn(message.league)
        return new Promise(async (resolve, _) => {
            const convo = await bot.startPrivateConversation([message.user])
            bot.say({ text: msg, channel: convo.channel.id })
            resolve()
        })
    }
}
