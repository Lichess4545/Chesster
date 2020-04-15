// -----------------------------------------------------------------------------
// Commands related to player information
// -----------------------------------------------------------------------------
import _ from 'lodash'

import * as lichess from '../lichess'
import { getAllLeagues, isPairingDetails } from '../league'
import {
    SlackBot,
    CommandMessage,
    isLeagueMember,
    LeagueMember,
} from '../slack'

function prepareRatingMessage(_player: string, rating: number) {
    return `${_player} is rated ${rating} in classical chess`
}

export async function playerRating(bot: SlackBot, message: CommandMessage) {
    const player = bot.getLeagueMemberTarget(message)
    if (!player) {
        bot.reply(message, 'I am sorry. I could not find that player.')
        return
    }
    const rating = await lichess.getPlayerRating(player.name)
    if (rating) {
        bot.reply(message, prepareRatingMessage(player.name, rating))
    } else {
        bot.reply(message, 'I am sorry. I could not find that player.')
    }
}

export function playerPairings(
    bot: SlackBot,
    message: CommandMessage
): Promise<void> {
    const targetPlayer = bot.getLeagueMemberTarget(message)
    return new Promise(async (resolve) => {
        if (isLeagueMember(targetPlayer)) {
            const member: LeagueMember = targetPlayer
            const allLeagues = getAllLeagues(bot)
            const convo = await bot.startPrivateConversation([message.user])
            const possiblePairings = await Promise.all(
                allLeagues.map(async (league) =>
                    league.getPairingDetails(member.lichess_username)
                )
            )
            const pairings = possiblePairings.filter(isPairingDetails)
            if (pairings.length < 1) {
                bot.say({
                    text: `${member.name} has no pairings`,
                    channel: convo.channel.id,
                })
            } else {
                pairings.map((details) => {
                    bot.say({
                        text: details.league.formatPairingResponse(
                            message.member,
                            details
                        ),
                        channel: convo.channel.id,
                    })
                })
            }
        } else {
            bot.reply(message, "I don't know that league member, sorry")
            resolve()
        }
        resolve()
    })
}
