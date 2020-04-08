//------------------------------------------------------------------------------
// Commands related to game nomination
//------------------------------------------------------------------------------
import _ from 'lodash'
import * as heltour from '../heltour'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

type HeltourLinkAccountsResult = any

//------------------------------------------------------------------------------
export function nomination(bot: SlackBot, message: CommandMessage) {
    if (!isDefined(message.league)) return
    bot.reply(
        message,
        `Use this link to nominate your choice: ${message.league.links.nominate}`
    )
}

//------------------------------------------------------------------------------
export function notification(bot: SlackBot, message: CommandMessage) {
    if (!isDefined(message.league)) return
    bot.reply(
        message,
        `Use this link to set your notifications preferences: ${message.league.links.notifications}`
    )
}

//------------------------------------------------------------------------------
export function availability(bot: SlackBot, message: CommandMessage) {
    if (!isDefined(message.league)) return
    bot.reply(
        message,
        `Use this link to set your availability: ${message.league.links.availability}`
    )
}

//------------------------------------------------------------------------------
export function linkAccounts(bot: SlackBot, message: CommandMessage) {
    var slackUser = bot.getSlackUserFromNameOrID(message.user)
    if (!isDefined(slackUser)) return
    heltour
        .linkSlack(
            bot.config.heltour,
            message.user,
            slackUser.profile['display_name'] || slackUser.profile['real_name']
        )
        .then(async (result: HeltourLinkAccountsResult) => {
            console.log(message.user)
            let convo = await bot.startPrivateConversation([message.user])

            var channelId = convo.channel.id
            var text = ''

            _.each(result.already_linked, function (username) {
                text += `Your Slack account is already linked with the Lichess account <https://lichess.org/@/${username}|${username}>.\n`
            })

            if (result.already_linked.length > 0) {
                text += `<${result.url}|Click here> to link another Lichess account.\n`
            } else {
                text += `<${result.url}|Click here> to link your Slack and Lichess accounts.\n`
            }

            bot.say({
                channel: channelId,
                text: text,
                attachments: [],
            })
        })
}

