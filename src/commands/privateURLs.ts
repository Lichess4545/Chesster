// -----------------------------------------------------------------------------
// Commands related to game nomination
// -----------------------------------------------------------------------------
import _ from 'lodash'
import * as heltour from '../heltour'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

// -----------------------------------------------------------------------------
export function nomination(bot: SlackBot, message: CommandMessage) {
    if (!isDefined(message.league)) return
    bot.reply(
        message,
        `Use this link to nominate your choice: ${message.league.links.nominate}`
    )
}

// -----------------------------------------------------------------------------
export function notification(bot: SlackBot, message: CommandMessage) {
    if (!isDefined(message.league)) return
    bot.reply(
        message,
        `Use this link to set your notifications preferences: ${message.league.links.notifications}`
    )
}

// -----------------------------------------------------------------------------
export function availability(bot: SlackBot, message: CommandMessage) {
    if (!isDefined(message.league)) return
    bot.reply(
        message,
        `Use this link to set your availability: ${message.league.links.availability}`
    )
}

// -----------------------------------------------------------------------------
export async function linkAccounts(bot: SlackBot, message: CommandMessage) {
    const slackUser = bot.getSlackUserFromNameOrID(message.user)
    if (!isDefined(slackUser)) return
    const result = await heltour.linkSlack(
        bot.config.heltour,
        message.user,
        slackUser.profile.display_name || slackUser.profile.real_name
    )
    const convo = await bot.startPrivateConversation([message.user])

    const channelId = convo.channel.id
    let text = ''

    _.each(result.alreadyLinked, (username) => {
        text += `Your Slack account is already linked with the Lichess account <https://lichess.org/@/${username}|${username}>.\n`
    })

    if (result.alreadyLinked.length > 0) {
        text += `<${result.url}|Click here> to link another Lichess account.\n`
    } else {
        text += `<${result.url}|Click here> to link your Slack and Lichess accounts.\n`
    }

    bot.say({
        channel: channelId,
        text,
        attachments: [],
    })
}
