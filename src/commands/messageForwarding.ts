import _ from 'lodash'
import winston from 'winston'
import * as commands from '../commands'
import * as league from '../league'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

export function forwardMessage(chesster: SlackBot, adminSlack: SlackBot) {
    return async (bot: SlackBot, message: CommandMessage) => {
        if (
            !_.isEqual(
                message.channel.id,
                adminSlack.config.messageForwarding.channelId
            )
        ) {
            return
        }
        const commandDescription = ['forward', 'to', '{text:targets}']
        try {
            const parameters = commands.tokenize(
                message.text,
                commandDescription
            )
            const targets = parameters.targets
            const messageToSend = message.attachments[0].text
            const channels: string[] = []
            const users: string[] = []
            _(targets.value)
                .split('+')
                .compact()
                .forEach((t) => {
                    if (_.startsWith(t, '@')) {
                        const user = chesster.users.getByNameOrID(t.substr(1))
                        if (user) users.push(user.id)
                    } else if (_.startsWith(t, '#')) {
                        channels.push(t)
                    } else if (_.startsWith(t, 'g') || _.startsWith(t, 'c')) {
                        channels.push(_.toUpper(t))
                    } else if (_.startsWith(t, 'u')) {
                        users.push(_.toUpper(t))
                    } else if (_.startsWith(t, '<@') && _.endsWith(t, '>')) {
                        const name = adminSlack.users.getByNameOrID(
                            t.substr(2, t.length - 3)
                        )?.name
                        if (!isDefined(name)) return

                        const user = chesster.users.getId(name)
                        if (!isDefined(user)) return
                        users.push(user)
                    } else {
                        const user = chesster.users.getId(t)
                        if (user) users.push(user)
                    }
                })

            const promises: Promise<void>[] = []
            if (users.length > 0) {
                promises.push(
                    chesster.startPrivateConversation(users).then((convo) => {
                        chesster.say({
                            channel: convo.channel.id,
                            text: messageToSend,
                        })
                    })
                )
            }
            _.forEach(channels, (channel) => {
                chesster.say({
                    channel,
                    text: messageToSend,
                    attachments: [],
                })
            })
            await Promise.all(promises)
            await bot.react(message, 'heavy_check_mark')
        } catch (error) {
            if (
                error instanceof commands.TooFewTokensError ||
                error instanceof commands.InvalidChoiceError ||
                error instanceof commands.InvalidConstantError ||
                error instanceof commands.InvalidTypeValueError
            ) {
                winston.error(
                    `Internal Error: Invalid format for message forwarding: ${JSON.stringify(
                        error
                    )}`
                )
            } else if (
                error instanceof commands.InvalidTokenDescriptionError ||
                error instanceof commands.InvalidTypeError
            ) {
                winston.error(
                    `[AVAILABILITY] Internal Error: Your description is not valid: ${JSON.stringify(
                        error
                    )}`
                )
            } else {
                // some unknown error, rethrow;
                throw error
            }
        }
    }
}

export function refreshLeague(chesster: SlackBot, adminSlack: SlackBot) {
    return (bot: SlackBot, message: CommandMessage) => {
        if (
            !_.isEqual(
                message.channel.id,
                adminSlack.config.messageForwarding.channelId
            )
        ) {
            return
        }
        const commandDescription = ['refresh', '{text:type}', '{text:league}']
        try {
            const parameters = commands.tokenize(
                message.text,
                commandDescription
            )
            const typeVar = parameters.type
            if (!commands.isText(typeVar)) {
                return
            }
            const type = typeVar.value
            const leagueNameVar = parameters.league
            if (!commands.isText(leagueNameVar)) {
                return
            }
            const leagueName = leagueNameVar.value
            const _league = league.getLeague(bot, leagueName)

            if (!isDefined(_league)) {
                winston.error(`No matching league: ${leagueName}`)
                return
            }
            const l = _league

            if (type === 'pairings') {
                l.refreshCurrentRoundSchedules()
                    .then(async (pairings) => {
                        winston.info(
                            'Found ' +
                                pairings.length +
                                ' pairings for ' +
                                l.name +
                                ' (manual refresh)'
                        )
                        l.emitter.emit('refreshPairings', l)
                        await bot.react(message, 'heavy_check_mark')
                    })
                    .catch((error) => {
                        winston.error(
                            `${
                                l.name
                            }: Error refreshing pairings: ${JSON.stringify(
                                error
                            )}`
                        )
                    })
            }
        } catch (error) {
            winston.error(
                `Error in league refresh command: ${JSON.stringify(error)}`
            )
        }
    }
}
