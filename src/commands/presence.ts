// -----------------------------------------------------------------------------
// Commands and helpers for detecting presence
// -----------------------------------------------------------------------------
import _ from 'lodash'

import * as heltour from '../heltour'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

export async function ambientPresence(bot: SlackBot, message: CommandMessage) {
    if (!message.channel.is_group) {
        return
    }
    const sender = bot.users.getByNameOrID(message.user)
    if (!isDefined(sender)) {
        return
    }
    if (!isDefined(bot.controller)) {
        return
    }

    const membersResponse = await bot.getChannelMemberList(message.channel)
    const recips = _.without(
        membersResponse.members,
        bot.controller.id,
        sender.id
    )
    if (recips.length !== 1) {
        return
    }
    let player = bot.getSlackUserFromNameOrID(recips[0])
    if (!player) {
        return
    }

    return await heltour.playerContact(
        bot.config.heltour,
        sender.lichess_username,
        player.lichess_username
    )
}

