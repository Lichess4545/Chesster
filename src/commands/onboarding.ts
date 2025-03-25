// -----------------------------------------------------------------------------
// Commands for onboarding new folks
// -----------------------------------------------------------------------------
import _ from 'lodash'
import * as heltour from '../heltour'
import {
    SlackBot,
    MemberJoinedChannel,
    CommandMessage,
    SlackChannel,
} from '../slack'

async function welcomeMessageImpl(
    bot: SlackBot,
    channel: SlackChannel,
    user: string
) {
    if (!_.isEqual(bot.config.welcome.channel, channel.name)) {
        return
    }
    const result = await heltour.linkSlack(bot.config.heltour, user, '')
    const convo = await bot.startPrivateConversation([user])
    const text = `*<${result.url}|click here to associate your Lichess account with your slack account.>*`
    bot.say({ channel: convo.channel!.id!, text, attachments: [] })
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
        const channel = await bot.getChannel(event.channel)
        if (!channel) {
            return
        }
        return welcomeMessageImpl(bot, channel, event.user)
    } else {
        return welcomeMessageImpl(bot, event.channel, event.user)
    }
}
