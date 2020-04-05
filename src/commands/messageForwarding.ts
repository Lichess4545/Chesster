import _ from 'lodash'
import winston from 'winston'
import * as commands from '../commands'
import * as league from '../league'
import { SlackBot, SlackMessage } from '../slack'
import { isDefined } from '../utils'

export function forwardMessage(chesster: SlackBot, adminSlack: SlackBot) {
    return async (bot: SlackBot, message: SlackMessage) => {
        if (
            !_.isEqual(
                message.channel,
                adminSlack.config.messageForwarding.channel
            )
        ) {
            return
        }
        var commandDescription = ['forward', 'to', '{text:targets}']
        try {
            let parameters = commands.tokenize(message.text, commandDescription)
            var targets = parameters['targets']
            var messageToSend = message.attachments[0].text
            var channels: string[] = []
            var users: string[] = []
            _(targets)
                .split('+')
                .compact()
                .forEach((t) => {
                    if (_.startsWith(t, '@')) {
                        let user = chesster.users.getId(t.substr(1))
                        if (user) users.push(user)
                    } else if (_.startsWith(t, '#')) {
                        channels.push(t)
                    } else if (_.startsWith(t, 'g') || _.startsWith(t, 'c')) {
                        channels.push(_.toUpper(t))
                    } else if (_.startsWith(t, 'u')) {
                        users.push(_.toUpper(t))
                    } else if (_.startsWith(t, '<@') && _.endsWith(t, '>')) {
                        var name = adminSlack.users.getByNameOrID(
                            t.substr(2, t.length - 3)
                        )?.name
                        if (!isDefined(name)) return

                        let user = chesster.users.getId(name)
                        if (!isDefined(user)) return
                        users.push(user)
                    } else {
                        let user = chesster.users.getId(t)
                        if (user) users.push(user)
                    }
                })

            var promises: Promise<void>[] = []
            if (users.length > 1) {
                promises.push(
                    chesster.startPrivateConversation(users).then((convo) => {
                        chesster.say({
                            channel: convo.channel.id,
                            text: messageToSend,
                        })
                    })
                )
            }
            _.forEach(channels, function (channel) {
                chesster.say({
                    channel: channel,
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
                //some unknown error, rethrow;
                throw error
            }
        }
    }
}

export function refreshLeague(chesster: SlackBot, adminSlack: SlackBot) {
    return function (bot: SlackBot, message: SlackMessage) {
        if (
            !_.isEqual(
                message.channel,
                adminSlack.config.messageForwarding.channel
            )
        ) {
            return
        }
        var commandDescription = ['refresh', '{text:type}', '{text:league}']
        try {
            let parameters = commands.tokenize(message.text, commandDescription)
            var typeVar = parameters['type']
            if (!commands.isText(typeVar)) {
                return
            }
            let type = typeVar.value
            var leagueNameVar = parameters['league']
            if (!commands.isText(leagueNameVar)) {
                return
            }
            let leagueName = leagueNameVar.value
            let _league = league.getLeague(bot, leagueName)

            if (!isDefined(_league)) {
                winston.error(`No matching league: ${leagueName}`)
                return
            }
            let l = _league

            if (type === 'pairings') {
                l.refreshCurrentRoundSchedules()
                    .then((pairings) => {
                        winston.info(
                            'Found ' +
                                pairings.length +
                                ' pairings for ' +
                                l.name +
                                ' (manual refresh)'
                        )
                        l.emitter.emit('refreshPairings', l)
                    })
                    .catch(function (error) {
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

