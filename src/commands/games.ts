// -----------------------------------------------------------------------------
// Commands and helpers related to gamelinks and results
// -----------------------------------------------------------------------------
import _ from 'lodash'
import moment from 'moment-timezone'
import winston from 'winston'
import * as scheduling from './scheduling'
import * as subscription from './subscription'
import * as heltour from '../heltour'
import * as lichess from '../lichess'
import { SlackBot, CommandMessage, LeagueCommandMessage } from '../slack'
import { isDefined } from '../utils'
import { League, Pairing as LeaguePairing, ResultsEnum } from '../league'

const SWORDS = '\u2694'

const VALID_RESULTS: Record<string, string> = {
    '0-0': '0-0',
    '1-0': '1-0',
    '0-1': '0-1',
    '1/2-1/2': '1/2-1/2',
    '0.5-0.5': '1/2-1/2',
    '1X-0F': '1X-0F',
    '0F-1X': '0F-1X',
    '0F-0F': '0F-0F',
    '1/2Z-1/2Z': '1/2Z-1/2Z',
    '0.5Z-0.5Z': '1/2Z-1/2Z',
    DRAW: '1/2-1/2',
    DREW: '1/2-1/2',
    GIRI: '1/2-1/2',
}

interface Players {
    white: string
    black: string
}

interface Result extends Players {
    result: string
}

// parse the input string for a results update
export function parseResult(inputString: string): Result | undefined {
    const tokens = getTokensResult(inputString)
    const result = findResult(tokens)
    const players = findPlayers(tokens)

    if (!isDefined(result) || !isDefined(players)) {
        return undefined
    }

    return { ...players, result }
}

function getTokensResult(inputString: string): string[] {
    return inputString.split(' ')
}

function findResult(tokens: string[]): string | undefined {
    let result: string | undefined
    _.some(tokens, (token) => {
        result = VALID_RESULTS[token.toUpperCase()]
        return result ? true : false
    })
    return result
}

function findPlayers(tokens: string[]): Players | undefined {
    // in reality, the order is arbitrary.
    // just assuming first I find is white, the second is black
    const playerTokens = filterPlayerTokens(tokens)

    // assuming we found 2 tokens, we should convert them to player names
    if (playerTokens.length === 2) {
        // remove punctuation and store. this fixes losts of stuff.
        // most frequent issue is the : added after a name by slack
        return {
            white: playerTokens[0].replace(/[:,.-]/, ''),
            black: playerTokens[1].replace(/[:,.-]/, ''),
        }
    }

    return undefined
}

function filterPlayerTokens(tokens: string[]): string[] {
    return _.filter(tokens, (token) => {
        // matches slack uer ids: <@[A-Z0-9]>[:]*
        return /^<@[A-Z0-9]+>[:,.-]*$/.test(token)
    })
}

function handleHeltourErrors(
    bot: SlackBot,
    message: CommandMessage,
    error: unknown
) {
    if (_.isEqual(error, 'no_matching_rounds')) {
        replyNoActiveRound(bot, message)
    } else if (_.isEqual(error, 'no_pairing')) {
        resultReplyMissingPairing(bot, message)
    } else if (_.isEqual(error, 'ambiguous')) {
        resultReplyTooManyPairings(bot, message)
    } else {
        replyGenericFailure(bot, message, '@endrawes0')
        throw new Error('Error making your update: ' + error)
    }
}

export async function ambientResults(
    bot: SlackBot,
    message: LeagueCommandMessage
) {
    const league: League = message.league
    const resultsOptions = message.league.config.results
    const heltourOptions = message.league.config.heltour
    const channel = message.channel
    if (!_.isEqual(channel.name, resultsOptions.channel)) {
        return
    }

    const result = parseResult(message.text)
    if (!isDefined(result)) {
        return
    }
    const white = bot.users.getByNameOrID(result.white.replace(/[<\@>]/g, ''))
    const black = bot.users.getByNameOrID(result.black.replace(/[<\@>]/g, ''))
    if (!isDefined(white) || !isDefined(black)) {
        replyPlayerNotFound(bot, message)
        return
    }

    const updateRequest: heltour.UpdatePairingRequest = {
        ...result,
        white,
        black,
    }

    const isModerator = message.isModerator
    if (
        !_.isEqual(white.id, message.user) &&
        !_.isEqual(black.id, message.user) &&
        !isModerator
    ) {
        replyPermissionFailure(bot, message)
        return
    }

    try {
        const pairings = await heltour.findPairing(
            heltourOptions,
            updateRequest.white.name,
            updateRequest.black.name,
            heltourOptions.leagueTag
        )
        if (pairings.length < 1) {
            resultReplyMissingPairing(bot, message)
            return
        }
        const pairing: heltour.Pairing = pairings[0]
        if (!_.isNil(pairing.gameLink) && !_.isEqual(pairing.gameLink, '')) {
            // process game details
            processGamelink(bot, message, pairing.gameLink, result)
        } else {
            if (isModerator) {
                // current speaker is a moderator for the league
                // update the pairing with the result bc there was no link found
                // TODO: update error handling
                const updatePairingResult = await heltour.updatePairing(
                    heltourOptions,
                    updateRequest
                )
                resultReplyUpdated(bot, message, result)

                if (updatePairingResult.resultChanged) {
                    subscription.emitter.emit(
                        'a-game-is-over',
                        message.league,
                        [white.name, black.name],
                        {
                            result: updatePairingResult,
                            white,
                            black,
                            leagueName: league.name,
                        }
                    )
                }
            } else {
                resultReplyMissingGamelink(bot, message)
            }
        }
    } catch (error) {
        handleHeltourErrors(bot, message, error)
        return
    }
}

function replyPermissionFailure(bot: SlackBot, message: CommandMessage) {
    bot.reply(
        message,
        'Sorry, you do not have permission to update that pairing.'
    )
}

function replyPlayerNotFound(bot: SlackBot, message: CommandMessage) {
    bot.reply(message, 'Sorry, I could not find one of the players on Slack.')
}

function resultReplyMissingGamelink(
    bot: SlackBot,
    message: LeagueCommandMessage
) {
    const league: League = message.league
    const channel = bot.channels.getByNameOrID(league.config.gamelinks.channel)
    if (!isDefined(channel)) {
        return
    }
    bot.reply(
        message,
        'Sorry, that game does not have a link. I will not update the result without it.'
    )
    bot.reply(
        message,
        'Please go to <#' + channel.id + '> and post the gamelink.'
    )
}

function resultReplyMissingPairing(bot: SlackBot, message: CommandMessage) {
    bot.reply(message, 'Sorry, I could not find that pairing.')
}

function resultReplyTooManyPairings(bot: SlackBot, message: CommandMessage) {
    bot.reply(
        message,
        'Sorry, I found too many pairings matching this. Please contact a mod.'
    )
}

function replyNoActiveRound(bot: SlackBot, message: CommandMessage) {
    const user = '<@' + message.user + '>'
    bot.reply(
        message,
        ':x: ' +
            user +
            ' There is currently no active round. If this is a mistake, contact a mod'
    )
}

function resultReplyUpdated(
    bot: SlackBot,
    message: CommandMessage,
    result: Result
) {
    bot.reply(
        message,
        'Got it. @' +
            result.white +
            ' ' +
            (result.result || SWORDS) +
            ' @' +
            result.black
    )
}

interface GameLinkResult {
    gamelinkID: string | undefined
}

// given the input text from a essage
export function parseGamelink(messageText: string): GameLinkResult {
    // split it into tokens separated by white space and slashes
    const tokens = messageText.split(/[<>\|\/\s]/)
    let foundBaseURL = false
    let gamelinkID

    // for each token, walk the list looking for a lichess url
    tokens.some((token) => {
        // if previously token was a lichess url
        // this token should be the gamelinkID
        if (foundBaseURL) {
            gamelinkID = token.replace('>', '')
            // some tokens will have a > if its the last token
            // return true to stop iterating
            return true
        }
        // current token is the base of the lichess url
        if (token.includes('lichess.org')) {
            foundBaseURL = true
        }
        return false
    })
    return { gamelinkID }
}

export interface GameValidationResult {
    valid: boolean
    pairing: LeaguePairing | undefined
    pairingWasNotFound: boolean
    colorsAreReversed: boolean
    gameIsUnrated: boolean
    timeControlIsIncorrect: boolean
    variantIsIncorrect: boolean
    gameOutsideOfCurrentRound: boolean
    claimVictoryNotAllowed: boolean
    cheatDetected: boolean
    reason: string
}

export function validateGameDetails(
    league: League,
    details: lichess.GameDetails
) {
    const result: GameValidationResult = {
        valid: true,
        pairing: undefined,
        pairingWasNotFound: false,
        colorsAreReversed: false,
        gameIsUnrated: false,
        timeControlIsIncorrect: false,
        variantIsIncorrect: false,
        gameOutsideOfCurrentRound: false,
        claimVictoryNotAllowed: false,
        cheatDetected: false,
        reason: '',
    }
    const options = league.config.gamelinks
    if (!isDefined(options)) {
        result.valid = false
        return result
    }
    const schedulingOptions = league.config.scheduling

    const white = details.players.white.user.id
    const black = details.players.black.user.id

    const potentialPairings = league.findPairing(white, black)
    if (potentialPairings.length !== 1) {
        result.valid = false
        result.pairingWasNotFound = true
        result.reason = 'the pairing was not found.'
        return result
    }
    const pairing = (result.pairing = potentialPairings[0])
    if (!details.clock) {
        result.valid = false
        result.timeControlIsIncorrect = true
        result.reason = `the game is unlimited or correspondence.`
    } else if (
        !_.isEqual(details.clock.initial, options.clock.initial * 60) || // initial time
        !_.isEqual(details.clock.increment, options.clock.increment) // increment
    ) {
        // the time control does not match options
        result.valid = false
        result.timeControlIsIncorrect = true
        result.reason = `the time control is incorrect. Correct time control is ${
            options.clock.initial
        }+${options.clock.increment}. Detected time control was ${
            details.clock.initial / 60
        }+${details.clock.increment}.`
    } else if (
        potentialPairings.length === 1 &&
        pairing &&
        _.isEqual(_.toLower(pairing.white), black)
    ) {
        result.valid = false
        result.colorsAreReversed = true
        result.reason = 'the colors are reversed.'
    } else if (!_.isEqual(details.rated, options.rated)) {
        // the game is not rated correctly
        result.valid = false
        result.gameIsUnrated = true
        result.reason = 'the game is ' + (options.rated ? 'unrated.' : 'rated.')
    } else if (!_.isEqual(details.variant, options.variant)) {
        // the variant does not match
        result.valid = false
        result.variantIsIncorrect = true
        result.reason = `the variant should be ${options.variant}.`
    } else if (_.isEqual(details.status, lichess.GameStatus.timeout)) {
        // claim victory is not allowed
        result.valid = false
        result.claimVictoryNotAllowed = true
        result.reason = 'using "Claim Victory" is not permitted. Contact a mod.'
    } else if (_.isEqual(details.status, lichess.GameStatus.cheat)) {
        // Cheating is not allowed.
        result.valid = false
        result.cheatDetected = true
        result.reason = 'The game ended with a "Cheat Detected". Contact a mod.'
    } else if (_.isEqual(details.status, lichess.GameStatus.aborted)) {
        // Cheating is not allowed.
        result.valid = false
        result.reason = 'Game was aborted'
    } else if (_.isEqual(details.status, lichess.GameStatus.nostart)) {
        result.valid = false
        result.reason = 'Game was never started'
    } else if (_.isEqual(details.status, lichess.GameStatus.unknownfinish)) {
        result.valid = false
        result.reason = 'Game has an unknown finish'
    } else {
        // the link is too old or too new
        const extrema = scheduling.getRoundExtrema(schedulingOptions)
        const gameStart = moment.utc(details.createdAt)
        if (
            gameStart.isBefore(extrema.start) ||
            gameStart.isAfter(extrema.end)
        ) {
            result.valid = false
            result.gameOutsideOfCurrentRound = true
            result.reason = 'the game was not played in the current round.'
        }
    }
    return result
}

async function gamelinkReplyInvalid(
    bot: SlackBot,
    message: CommandMessage,
    reason: string
) {
    await bot.reply(
        message,
        'I am sorry, <@' +
            message.user +
            '>,  ' +
            'your post is *not valid* because ' +
            '*' +
            reason +
            '*'
    )
    await bot.reply(
        message,
        'If this was a mistake, please correct it and ' +
            'try again. If intentional, please contact one ' +
            'of the moderators for review. Thank you.'
    )
}

function replyGenericFailure(
    bot: SlackBot,
    message: CommandMessage,
    contact: string
) {
    bot.reply(message, 'Something went wrong. Notify ' + contact)
}

function gamelinkReplyUnknown(bot: SlackBot, message: CommandMessage) {
    bot.reply(
        message,
        'Sorry, I could not find that game. Please verify your gamelink.'
    )
}

function validateUserResult(details: lichess.GameDetails, result: Result) {
    // if colors are reversed, in the game link, we will catch that later
    // we know the players are correct or we would not already be here
    // the only way we can validate the result is if the order is 100% correct.
    const validity = {
        valid: true,
        reason: '',
    }
    if (details.winner && _.isEqual(result.result, '1/2-1/2')) {
        // the details gave a winner but the user claimed draw
        validity.reason =
            'the user claimed a draw ' +
            'but the gamelink specifies ' +
            details.winner +
            ' as the winner.'
        validity.valid = false
    } else if (
        _.isEqual(details.winner, 'black') &&
        _.isEqual(result.result, '1-0')
    ) {
        // the details gave the winner as black but the user claimed white
        validity.reason =
            'the user claimed a win for white ' +
            'but the gamelink specifies black as the winner.'
        validity.valid = false
    } else if (
        _.isEqual(details.winner, 'white') &&
        _.isEqual(result.result, '0-1')
    ) {
        // the details gave the winner as white but the user claimed black
        validity.reason =
            'the user claimed a win for black ' +
            'but the gamelink specifies white as the winner.'
        validity.valid = false
    } else if (
        _.isEqual(details.status, 'draw') &&
        !_.isEqual(result.result, '1/2-1/2')
    ) {
        // the details gave a draw but the user did not claim a draw
        validity.reason =
            'the user claimed a decisive result ' +
            'but the gamelink specifies a draw.'
        validity.valid = false
    }
    return validity
}

async function processGamelink(
    bot: SlackBot,
    message: CommandMessage,
    gamelink: string,
    userResult?: Result
) {
    // get the gamelink id if one is in the message
    const result = parseGamelink(gamelink)
    if (!isDefined(result.gamelinkID)) {
        // no gamelink found. we can ignore this message
        return
    }
    // get the game details
    const details = await lichess.fetchGameDetails(result.gamelinkID)
    try {
        // validate the game details vs the user specified result
        if (isDefined(userResult)) {
            const validity = validateUserResult(details, userResult)
            if (!validity.valid) {
                await gamelinkReplyInvalid(bot, message, validity.reason)
                return
            }
        }
        return processGameDetails(bot, message, details)
    } catch (error) {
        winston.error(JSON.stringify(error))
        bot.reply(
            message,
            'Sorry, I failed to get game details for ' +
                gamelink +
                '. Try again later or reach out to a moderator to make the update manually.'
        )
    }
}

async function processGameDetails(
    bot: SlackBot,
    message: CommandMessage,
    details: lichess.GameDetails
) {
    if (!isDefined(message.league)) {
        return
    }
    // if no details were found the link was no good
    if (!details) {
        gamelinkReplyUnknown(bot, message)
        return
    }

    // verify the game meets the requirements of the channel we are in
    const validity = validateGameDetails(message.league, details)
    if (!validity.valid) {
        // game was not valid
        await gamelinkReplyInvalid(bot, message, validity.reason)
        return
    }
    const updatePairingResult = await updateGamelink(message.league, details)
    resultReplyUpdated(bot, message, {
        white: updatePairingResult.white,
        black: updatePairingResult.black,
        result: details.result,
    })
}

export async function updateGamelink(
    league: League,
    details: lichess.GameDetails
) {
    // our game is valid
    // get players to update the result in the sheet
    const result: heltour.UpdatePairingRequest = {
        white: details.players.white.user,
        black: details.players.black.user,
        result: details.result,
        game_link: `https://lichess.org/${details.id}`,
    }

    // get the result in the correct format
    if (
        _.isEqual(details.status, 'draw') ||
        _.isEqual(details.status, 'stalemate') ||
        details.winner
    ) {
        if (_.isEqual(details.winner, 'black')) {
            result.result = '0-1'
        } else if (_.isEqual(details.winner, 'white')) {
            result.result = '1-0'
        } else {
            result.result = '1/2-1/2'
        }
    }

    // gamelinks only come from played games, so ignoring forfeit result types

    // update the website with results from gamelink
    const updatePairingResult = await heltour.updatePairing(
        league.config.heltour,
        result
    )

    const white = result.white
    const black = result.black
    if (
        updatePairingResult.gameLinkChanged &&
        details.result === ResultsEnum.UNKNOWN
    ) {
        subscription.emitter.emit(
            'a-game-starts',
            league,
            [white.name, black.name],
            {
                league,
                details,
                white,
                black,
            }
        )
    } else if (
        updatePairingResult.resultChanged &&
        details.result !== ResultsEnum.UNKNOWN
    ) {
        subscription.emitter.emit(
            'a-game-is-over',
            league,
            [white.name, black.name],
            {
                league,
                details,
                white,
                black,
            }
        )
    }
    return updatePairingResult
}

export function ambientGamelinks(bot: SlackBot, message: CommandMessage) {
    if (!message.league) {
        return
    }
    const channel = bot.channels.byId[message.channel.id]
    if (!channel) {
        return
    }
    const gamelinkOptions = message.league.config.gamelinks
    if (!_.isEqual(channel.name, gamelinkOptions.channel)) {
        return
    }
    const heltourOptions = message.league.config.heltour
    if (!heltourOptions) {
        winston.error(
            `[GAMELINK] ${message.league.name} league doesn't have heltour options!?`
        )
        return
    }

    try {
        return processGamelink(bot, message, message.text)
    } catch (e) {
        // at the moment, we do not throw from inside the api - rethrow
        throw e
    }
}
