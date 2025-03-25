// -----------------------------------------------------------------------------
// Commands related to league information
// -----------------------------------------------------------------------------
import { SlackBot, LeagueCommandMessage } from '../slack'
import { League } from '../league'

// A helper for a very common pattern
type FormatFn = (l: League) => string
export function directResponse(fn: FormatFn) {
    return (bot: SlackBot, message: LeagueCommandMessage) => {
        const msg = fn(message.league)
        bot.reply(message, msg)
    }
}

// A helper for a very common pattern
export function dmResponse(fn: FormatFn) {
    return (bot: SlackBot, message: LeagueCommandMessage) => {
        const msg = fn(message.league)
        return new Promise<void>(async (resolve, _) => {
            const convo = await bot.startPrivateConversation([message.user])
            bot.say({ text: msg, channel: convo.channel!.id! })
            resolve()
        })
    }
}
