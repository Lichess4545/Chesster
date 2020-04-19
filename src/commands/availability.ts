// -----------------------------------------------------------------------------
// Commands related to availability
// -----------------------------------------------------------------------------
import winston from 'winston'
import _ from 'lodash'

import * as commands from '../commands'
import * as heltour from '../heltour'
import { SlackBot, CommandMessage } from '../slack'
import { Team } from '../league'
import { isDefined } from '../utils'

import * as utils from './utils'

function replyFailedToUpdate(
    bot: SlackBot,
    message: CommandMessage,
    task: string,
    error: string
) {
    bot.reply(message, `I failed to update ${task}: ${error}`)
    bot.reply(message, 'Please contact a moderator.')
}

function replyOnlyACaptainOrAModeratorCanDoThat(
    bot: SlackBot,
    message: CommandMessage
) {
    bot.reply(
        message,
        "Only the team's captain or a league moderator can do that."
    )
}

function replyThatsNotYourTeamName(
    bot: SlackBot,
    message: CommandMessage,
    speakerTeam: Team,
    teamName: string
) {
    bot.reply(
        message,
        `${teamName} does not match your team name: ${speakerTeam.name}`
    )
}

function formatReplyUpdatedAvailability(
    bot: SlackBot,
    message: CommandMessage,
    playerName: string,
    available: boolean,
    roundNumber: number
) {
    const not = available ? '' : ' not'
    bot.reply(
        message,
        `I have updated the availability. ` +
            `*@${playerName} will${not}* be available for *round ${roundNumber}*.`
    )
}

function replyUnrecognizedTeam(
    bot: SlackBot,
    message: CommandMessage,
    team: string
) {
    bot.reply(message, 'I do not recognize the team: ' + team)
}

function replyMisunderstood(
    bot: SlackBot,
    message: CommandMessage,
    command: string,
    syntax: string
) {
    bot.reply(message, `Sorry, I did not understand your ${command}`)
    bot.reply(message, 'Please use the following syntax:')
    bot.reply(message, `\`${syntax}\``)
}

function replyMisunderstoodAvailability(
    bot: SlackBot,
    message: CommandMessage
) {
    replyMisunderstood(
        bot,
        message,
        'availability',
        '[player <player> is] {available,unavailable} during round <round-number> in <league>'
    )
}

function replyMisunderstoodAlternateAssignment(
    bot: SlackBot,
    message: CommandMessage
) {
    replyMisunderstood(
        bot,
        message,
        'alternate assignment',
        'assign <player> to board <board-number> during round <round-number> on <team-name>'
    )
}

function replyMisunderstoodAlternateUnassignment(
    bot: SlackBot,
    message: CommandMessage
) {
    replyMisunderstood(
        bot,
        message,
        'alternate unassignment',
        'unassign alternate for board <board-number> during round <round-number> on <team-name>'
    )
}

/* [player <player-name> is] {available, unavailable} for round <round-number> in <league> */
export function updateAvailability(bot: SlackBot, message: CommandMessage) {
    const heltourOptions = message.league?.config.heltour
    if (!heltourOptions) {
        winston.error(
            `${message.league?.name} league doesn't have heltour options.`
        )
        return
    }

    let commandDescription
    if (_.isEqual(_(message.text).split(' ').head(), 'player')) {
        commandDescription = [
            'player',
            '{text:playerName}',
            'is',
            '{available|unavailable}',
            '{for|during}',
            'round',
            '{int:roundNumber}',
            '{in|of}',
            '{text:league}',
        ]
    } else {
        commandDescription = [
            '{available|unavailable}',
            '{for|during}',
            'round',
            '{int:roundNumber}',
            '{in|of}',
            '{text:league}',
        ]
    }

    try {
        const parameters = commands.tokenize(message.text, commandDescription)

        const available = parameters.available ? true : false
        const roundNumberVar = parameters.roundNumber
        if (!commands.isNumber(roundNumberVar)) {
            bot.reply(message, 'Round number is incorrect')
            return
        }
        const roundNumber = roundNumberVar.value
        const targetName = parameters.playerName
        if (targetName && commands.isText(targetName)) {
            const speaker = message.member

            if (!isDefined(message.league)) {
                bot.reply(
                    message,
                    `I couldn't figure out the league for this command`
                )
                return
            }

            const speakerTeam = message.league.getTeamByPlayerName(speaker.name)
            if (!isDefined(speakerTeam)) {
                bot.reply(message, `I couldn't figure your team`)
                return
            }
            // targetName is specified as an identifier or clear text, validate it and get the name
            const slackUser = bot.getSlackUserFromNameOrID(targetName.value)
            if (!slackUser) {
                // didnt find a user by Name or ID
                replyFailedToUpdate(
                    bot,
                    message,
                    'availability',
                    `unknown player: ${targetName.value}`
                )
                return
            }
            const playerName = slackUser.name
            // get the team associated with the player
            const playerTeam = message.league.getTeamByPlayerName(playerName)
            if (!isDefined(playerTeam)) {
                bot.reply(
                    message,
                    `I couldn't figure the team for the payer you specified.`
                )
                return
            }

            // get the team associated with the speaker
            // the speaker must be the captain of the player's team or a moderator
            if (
                !utils.isCaptainOrModerator(
                    speaker,
                    speakerTeam,
                    playerTeam.name,
                    message.league
                )
            ) {
                replyOnlyACaptainOrAModeratorCanDoThat(bot, message)
                return
            }

            return heltour
                .setAvailability(
                    heltourOptions,
                    playerName,
                    available,
                    roundNumber
                )
                .then(() =>
                    formatReplyUpdatedAvailability(
                        bot,
                        message,
                        playerName,
                        available,
                        roundNumber
                    )
                )
                .catch((error) => {
                    replyFailedToUpdate(bot, message, 'availability', error)
                })
        }
    } catch (error) {
        if (
            error instanceof commands.TooFewTokensError ||
            error instanceof commands.InvalidChoiceError ||
            error instanceof commands.InvalidConstantError ||
            error instanceof commands.InvalidTypeValueError
        ) {
            winston.debug(
                `[AVAILABILITY] Couldn't understand ${JSON.stringify(error)}`
            )
            replyMisunderstoodAvailability(bot, message)
        } else if (
            error instanceof commands.InvalidTokenDescriptionError ||
            error instanceof commands.InvalidTypeError
        ) {
            winston.error(
                `[AVAILABILITY] Internal Error: Your description is not valid: {JSON.stringify(error)}`
            )
        } else {
            // some unknown error, rethrow;
            throw error
        }
    }
}

/* assign <player> to board <board-number> during round <round-number> on <team-name>*/
export function assignAlternate(bot: SlackBot, message: CommandMessage) {
    const alternateOptions = message.league?.alternate
    if (
        !alternateOptions ||
        !_.isEqual(message.channel.id, alternateOptions.channel_id)
    ) {
        return
    }
    const heltourOptions = message.league?.config.heltour
    if (!heltourOptions) {
        winston.error(
            `${message.league?.name} league doesn't have heltour options!?`
        )
        return
    }

    try {
        const parameters = commands.tokenize(message.text, [
            'assign',
            '{text:playerName}',
            'to',
            'board',
            '{int:boardNumber}',
            '{during|for|in}',
            'round',
            '{int:roundNumber}',
            '{on|for|in}',
            '{text:teamName}',
        ])
        const speaker = bot.getSlackUserFromNameOrID(message.user)
        if (!isDefined(speaker)) {
            bot.reply(message, `I don't reocgnize you, sorry.`)
            return
        }

        if (!isDefined(message.league)) {
            bot.reply(
                message,
                `I couldn't figure out the league for this command`
            )
            return
        }

        const speakerTeam = message.league.getTeamByPlayerName(speaker.name)
        if (!isDefined(speakerTeam)) {
            bot.reply(message, `I couldn't figure your team`)
            return
        }

        const teamNameVar = parameters.teamName
        if (!commands.isText(teamNameVar)) {
            bot.reply(message, 'Round number is incorrect')
            return
        }
        const teamName = teamNameVar.value

        const playerNameVar = parameters.playerName
        if (!commands.isText(playerNameVar)) {
            bot.reply(message, 'Round number is incorrect')
            return
        }
        let playerName = playerNameVar.value

        if (!message.league.isModerator(speaker.name)) {
            if (
                !_.isEqual(_.lowerCase(speakerTeam.name), _.lowerCase(teamName))
            ) {
                replyThatsNotYourTeamName(bot, message, speakerTeam, teamName)
                return
            }
        }

        if (
            !utils.isCaptainOrModerator(
                speaker,
                speakerTeam,
                teamName,
                message.league
            )
        ) {
            replyOnlyACaptainOrAModeratorCanDoThat(bot, message)
            return
        }

        const boardNumberVar = parameters.boardNumber
        if (!commands.isNumber(boardNumberVar)) {
            bot.reply(message, 'Round number is incorrect')
            return
        }
        const boardNumber = boardNumberVar.value
        const roundNumberVar = parameters.roundNumber
        if (!commands.isNumber(roundNumberVar)) {
            bot.reply(message, 'Round number is incorrect')
            return
        }
        const roundNumber = roundNumberVar.value

        const team = message.league.getTeam(teamName)
        if (!team) {
            replyUnrecognizedTeam(bot, message, teamName)
            return
        }

        const player = bot.getSlackUserFromNameOrID(playerName)
        if (!isDefined(player)) {
            replyFailedToUpdate(
                bot,
                message,
                'alternate assignment',
                'unknown player'
            )
            return
        }
        if (_(playerName).toUpper().includes(player.id)) {
            // currently commands makes everything lower case
            // until I have added something to control the case-sensitivity
            // I will need to convert player ids to upper case.
            playerName = _.toUpper(playerName)
        }
        return heltour
            .assignAlternate(
                heltourOptions,
                roundNumber,
                team.number,
                boardNumber,
                player.name
            )
            .then(() => {
                bot.reply(
                    message,
                    `*${playerName}* has been assigned to *board ${boardNumber}* for *${teamName}* during *round ${roundNumber}*`
                )
            })
            .catch((error) => {
                replyFailedToUpdate(bot, message, 'alternate assignment', error)
            })
    } catch (error) {
        if (
            error instanceof commands.TooFewTokensError ||
            error instanceof commands.InvalidChoiceError ||
            error instanceof commands.InvalidConstantError
        ) {
            winston.debug(
                `[ASSIGNMENT] Invalid command format: ${JSON.stringify(error)}`
            )
        } else if (error instanceof commands.InvalidTypeValueError) {
            winston.debug(
                `[ASSIGNMENT] Couldn't understand: ${JSON.stringify(error)}`
            )
            replyMisunderstoodAlternateAssignment(bot, message)
        } else if (
            error instanceof commands.InvalidTokenDescriptionError ||
            error instanceof commands.InvalidTypeError
        ) {
            winston.error(
                `[ASSIGNMENT] Internal Error: Your description is not valid: ${JSON.stringify(
                    error
                )}`
            )
        } else {
            // some unknown error, rethrow;
            throw error
        }
    }
}

/* unassign alternate for board <board-number> during round <round-number> on <team-name> */
/* look up the original player and assign him to his board */
export function unassignAlternate(bot: SlackBot, message: CommandMessage) {
    const alternateOptions = message.league?.alternate
    if (
        !alternateOptions ||
        !_.isEqual(message.channel.id, alternateOptions.channel_id)
    ) {
        return
    }
    const heltourOptions = message.league?.config.heltour
    if (!heltourOptions) {
        winston.error(
            `${message.league?.name} league doesn't have heltour options!?`
        )
        return
    }

    let components = message.text.split(' ')
    components = components.filter((p) => p !== '')
    const args = _.map(components.slice(0, 9), _.toLower)
    const teamName = components.splice(9).join(' ')
    const unassign = args[0]
    const alternate = args[1]
    // const _for = args[2]
    const board = args[3]
    const boardNumberStr = args[4]
    // const during = args[5]
    const round = args[6]
    const roundNumberStr = args[7]
    const on = args[8]

    const speaker = bot.getSlackUserFromNameOrID(message.user)
    if (!isDefined(speaker)) {
        bot.reply(message, `I don't reocgnize you, sorry.`)
        return
    }

    if (!isDefined(message.league)) {
        bot.reply(message, `I couldn't figure out the league for this command`)
        return
    }

    const speakerTeam = message.league.getTeamByPlayerName(speaker.name)
    if (!isDefined(speakerTeam)) {
        bot.reply(message, `I couldn't figure your team`)
        return
    }

    if (
        !utils.isCaptainOrModerator(
            speaker,
            speakerTeam,
            teamName,
            message.league
        )
    ) {
        replyOnlyACaptainOrAModeratorCanDoThat(bot, message)
        return
    }

    // Ensure the basic command format is valid
    if (
        !_.isEqual(
            ['unassign', 'alternate', 'board', 'round', 'on'],
            [unassign, alternate, board, round, on]
        )
    ) {
        replyMisunderstoodAlternateUnassignment(bot, message)
        return
    }

    const boardNumber = parseInt(boardNumberStr, 10)
    if (isNaN(boardNumber)) {
        replyMisunderstoodAlternateUnassignment(bot, message)
        return
    }

    const roundNumber = parseInt(roundNumberStr, 10)
    if (isNaN(roundNumber)) {
        replyMisunderstoodAlternateUnassignment(bot, message)
        return
    }

    const team = message.league.getTeam(teamName)
    if (!team) {
        replyUnrecognizedTeam(bot, message, teamName)
        return
    }
    const player = team.players[boardNumber - 1].username
    return heltour
        .assignAlternate(
            heltourOptions,
            roundNumber,
            team.number,
            boardNumber,
            player
        )
        .then(() =>
            bot.reply(
                message,
                player +
                    ' has been assigned to board ' +
                    boardNumber +
                    ' for ' +
                    teamName +
                    ' during round ' +
                    roundNumber
            )
        )
        .catch((error) => {
            replyFailedToUpdate(bot, message, 'alternate assignment', error)
        })
}
