// -----------------------------------------------------------------------------
// Commands and helpers for detecting presence
// -----------------------------------------------------------------------------
import _ from 'lodash'

import * as heltour from '../heltour'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

export async function ambientPresence(bot: SlackBot, message: CommandMessage) {
    /*const mpim = bot.mpims.getByNameOrID(message.channel.id)
    if (!mpim) {
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

    return await heltour.playerContact(
        bot.config.heltour,
        sender.name,
        recips[0]
    )*/
}

