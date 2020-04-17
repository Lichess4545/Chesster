// -----------------------------------------------------------------------------
// Commands for onboarding new folks
// -----------------------------------------------------------------------------
import _ from 'lodash'
import * as heltour from '../heltour'
import { SlackBot, MemberJoinedChannel, CommandMessage } from '../slack'

async function welcomeMessageImpl(
    bot: SlackBot,
    channel: string,
    user: string
) {
    const result = await heltour.linkSlack(bot.config.heltour, user, '')
    bot.say({
        channel: channel,
        text:
            'Everyone, please welcome the newest member of the ' +
            `Lichess 45+45 League, <@${user}>!`,
    })

    const convo = await bot.startPrivateConversation([user])

    const channelId = convo.channel.id

    const _4545FAQ = bot.config.leagues['45+45'].links.faq
    const lonewolfFAQ = bot.config.leagues.lonewolf.links.faq
    const text =
        'Welcome. I am the league moderator bot.\n' +
        `*Before you can participate, you must <${result.url}|click here to link your Slack and Lichess accounts.>*\n` +
        'After that, read the FAQ for your league: ' +
        `<${_4545FAQ}|4545 League FAQ>` +
        `| <${lonewolfFAQ}|LoneWolf FAQ>\n` +
        "Say 'help' to get help. Enjoy the league!"

    bot.say({
        channel: channelId,
        text,
        attachments: [],
    })
}

export function isMemberJoinedChannelEvent(
    event: MemberJoinedChannel | CommandMessage
): event is MemberJoinedChannel {
    return event.type === 'member_joined_channel'
}
export async function welcomeMessage(
    bot: SlackBot,
    event: MemberJoinedChannel | CommandMessage
) {
    if (isMemberJoinedChannelEvent(event)) {
        return welcomeMessageImpl(bot, event.channel, event.user)
    } else {
        return welcomeMessageImpl(bot, event.channel.name, event.user)
    }
}
