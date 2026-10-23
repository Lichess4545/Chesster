import _ from 'lodash'
import winston from 'winston'
import * as commands from '../commands'
import * as league from '../league'
import { SlackBot, CommandMessage } from '../slack'
import { isDefined } from '../utils'

const slackChannelIDRegex = /^[cg][a-z0-9]{8,}$/
const slackUserIDRegex = /^[uw][a-z0-9]{8,}$/

type ForwardingTarget =
    | { kind: 'user'; id: string }
    | { kind: 'channel'; id: string }

function isChannelName(target: string) {
    return _.startsWith(target, '#')
}

function isAdminSlackMention(target: string) {
    return _.startsWith(target, '<@') && _.endsWith(target, '>')
}

function withoutAtSign(target: string) {
    return _.startsWith(target, '@') ? target.slice(1) : target
}

function resolveAdminSlackMention(
    chesster: SlackBot,
    adminSlack: SlackBot,
    mention: string
): ForwardingTarget | undefined {
    const adminUserID = mention.slice(2, -1)
    const name = adminSlack.users.getByNameOrID(adminUserID)?.name
    if (!isDefined(name)) return undefined
    return resolveCachedUser(chesster, name)
}

function resolveCachedUser(
    chesster: SlackBot,
    nameOrId: string
): ForwardingTarget | undefined {
    const user = chesster.users.getByNameOrID(nameOrId)
    return user ? { kind: 'user', id: user.id } : undefined
}

function resolveRawChannelID(nameOrId: string): ForwardingTarget | undefined {
    return slackChannelIDRegex.test(nameOrId)
        ? { kind: 'channel', id: _.toUpper(nameOrId) }
        : undefined
}

function resolveRawUserID(nameOrId: string): ForwardingTarget | undefined {
    return slackUserIDRegex.test(nameOrId)
        ? { kind: 'user', id: _.toUpper(nameOrId) }
        : undefined
}

function resolveTarget(
    chesster: SlackBot,
    adminSlack: SlackBot,
    target: string
): ForwardingTarget | undefined {
    if (isChannelName(target)) {
        return { kind: 'channel', id: target }
    }
    if (isAdminSlackMention(target)) {
        return resolveAdminSlackMention(chesster, adminSlack, target)
    }
    const nameOrId = withoutAtSign(target)
    return (
        resolveCachedUser(chesster, nameOrId) ??
        resolveRawChannelID(nameOrId) ??
        resolveRawUserID(nameOrId)
    )
}

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
            const unresolved: string[] = []
            _(targets.value)
                .split('+')
                .compact()
                .forEach((t) => {
                    const target = resolveTarget(chesster, adminSlack, t)
                    if (target?.kind === 'user') users.push(target.id)
                    else if (target?.kind === 'channel') channels.push(target.id)
                    else unresolved.push(t)
                })
            if (unresolved.length > 0) {
                winston.warn(
                    `[FORWARDING] Unable to resolve targets ${unresolved.join(', ')} from: ${message.text}`
                )
            }

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
