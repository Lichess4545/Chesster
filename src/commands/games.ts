//------------------------------------------------------------------------------
// Commands and helpers related to gamelinks and results
//------------------------------------------------------------------------------
import _ from 'lodash'
import moment from 'moment-timezone'
import winston from 'winston'
import * as scheduling from './scheduling'
import subscription from './subscription'
import * as heltour from '../heltour.js'
import * as http from '../http.js'
import { SlackBot, CommandMessage, LeagueMember } from '../slack.js'
import { isDefined } from '../utils'
import { League } from '../league'

type FindPairingResult = any
type Pairing = any
type GameDetails = any
type HeltourResultDetails = any
type HeltourUserResult = any
type HeltourResultPost = any

const TIMEOUT = 33
const CHEAT = 36
var SWORDS = '\u2694'

var VALID_RESULTS: Record<string, string> = {
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
interface ResultPlayer {
    white: LeagueMember
    black: LeagueMember
    result: string
}

// parse the input string for a results update
export function parseResult(inputString: string): Result | undefined {
    var tokens = getTokensResult(inputString)
    var result = findResult(tokens)
    var players = findPlayers(tokens)

    if (!isDefined(result) || !isDefined(players)) {
        return undefined
    }

    return {
        ...players,
        result: result,
    }
}

function getTokensResult(inputString: string): string[] {
    return inputString.split(' ')
}

function findResult(tokens: string[]): string | undefined {
    var result: string | undefined = undefined
    _.some(tokens, token => {
        result = VALID_RESULTS[token.toUpperCase()]
        return result ? true : false
    })
    return result
}

function findPlayers(tokens: string[]): Players | undefined {
    // in reality, the order is arbitrary.
    // just assuming first I find is white, the second is black
    var playerTokens = filterPlayerTokens(tokens)

    //assuming we found 2 tokens, we should convert them to player names
    if (playerTokens.length === 2) {
        //remove punctuation and store. this fixes losts of stuff.
        //most frequent issue is the : added after a name by slack
        return {
            white: playerTokens[0].replace(/[:,.-]/, ''),
            black: playerTokens[1].replace(/[:,.-]/, ''),
        }
    }

    return undefined
}

function filterPlayerTokens(tokens: string[]): string[] {
    return _.filter(tokens, function(token) {
        //matches slack uer ids: <@[A-Z0-9]>[:]*
        return /^<@[A-Z0-9]+>[:,.-]*$/.test(token)
    })
}

function handleHeltourErrors(
    bot: SlackBot,
    message: CommandMessage,
    error: string
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

export function ambientResults(bot: SlackBot, message: CommandMessage) {
    if (!message.league) {
        return
    }
    var resultsOptions = message.league.results
    var channel = bot.channels.byId[message.channel.id]
    if (!channel) {
        return
    }
    if (!resultsOptions || !_.isEqual(channel.name, resultsOptions.channel)) {
        return
    }

    var heltourOptions = message.league.heltour
    if (!heltourOptions) {
        winston.error(
            `${message.league?.name} league doesn't have heltour options!?`
        )
        return
    }

    var gamelinkOptions = message.league.gamelinks
    if (!gamelinkOptions) {
        return
    }

    try {
        let speaker = message.member
        var result = parseResult(message.text)
        if (!isDefined(result)) {
            return
        }
        if (!isDefined(message.league)) {
            return
        }
        let leagueName = message.league
        let white = bot.users.getByNameOrID(result.white.replace(/[<\@>]/g, ''))
        let black = bot.users.getByNameOrID(result.black.replace(/[<\@>]/g, ''))
        if (!isDefined(white) || !isDefined(black)) {
            return
        }

        var resultPlayer: ResultPlayer = {
            ...result,
            white: white,
            black: black,
        }

        if (!result.white || !result.black) {
            replyPlayerNotFound(bot, message)
            return
        }

        let isModerator = message.league.isModerator(speaker.name)
        if (
            !_.isEqual(resultPlayer.white.id, message.user) &&
            !_.isEqual(resultPlayer.black.id, message.user) &&
            !isModerator
        ) {
            replyPermissionFailure(bot, message)
            return
        }

        return heltour
            .findPairing(
                heltourOptions,
                resultPlayer.white.name,
                resultPlayer.black.name,
                heltourOptions.leagueTag
            )
            .then((findPairingResult: FindPairingResult) => {
                if (findPairingResult['error']) {
                    handleHeltourErrors(
                        bot,
                        message,
                        findPairingResult['error']
                    )
                    return
                }

                var pairing: Pairing = _.head(
                    findPairingResult['json'].pairings
                )
                if (
                    !_.isNil(pairing) &&
                    !_.isNil(pairing.game_link) &&
                    !_.isEqual(pairing.game_link, '')
                ) {
                    //process game details
                    processGamelink(bot, message, pairing.game_link, result)
                } else if (!_.isNil(pairing)) {
                    if (isModerator) {
                        //current speaker is a moderator for the league
                        //update the pairing with the result bc there was no link found
                        heltour
                            .updatePairing(heltourOptions, result)
                            .then(function(updatePairingResult) {
                                if (updatePairingResult['error']) {
                                    handleHeltourErrors(
                                        bot,
                                        message,
                                        updatePairingResult['error']
                                    )
                                    return
                                }
                                resultReplyUpdated(
                                    bot,
                                    message,
                                    updatePairingResult
                                )

                                var white = resultPlayer.white
                                var black = resultPlayer.black
                                if (
                                    updatePairingResult['resultChanged'] &&
                                    !_.isEmpty(updatePairingResult.result)
                                ) {
                                    subscription.emitter.emit(
                                        'a-game-is-over',
                                        message.league,
                                        [white.name, black.name],
                                        {
                                            result: updatePairingResult,
                                            white: white,
                                            black: black,
                                            leagueName: leagueName,
                                        }
                                    )
                                }
                            })
                    } else {
                        resultReplyMissingGamelink(bot, message)
                    }
                } else {
                    resultReplyMissingPairing(bot, message)
                }
            })
    } catch (e) {
        //at the moment, we do not throw from inside the api - rethrow
        throw e
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

function resultReplyMissingGamelink(bot: SlackBot, message: CommandMessage) {
    var channel = bot.channels.byName[message.league?.gamelinks?.channel]
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
    var user = '<@' + message.user + '>'
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
    result: ResultPlayer
) {
    bot.reply(
        message,
        'Got it. @' +
            result.white.name +
            ' ' +
            (result.result || SWORDS) +
            ' @' +
            result.black.name
    )
}

interface GameLinkResult {
    gamelinkID: string | undefined
}

//given the input text from a essage
export function parseGamelink(messageText: string): GameLinkResult {
    //split it into tokens separated by white space and slashes
    var tokens = messageText.split(/[<>\|\/\s]/)
    var foundBaseURL = false
    var gamelinkID

    //for each token, walk the list looking for a lichess url
    tokens.some(function(token) {
        //if previously token was a lichess url
        //this token should be the gamelinkID
        if (foundBaseURL) {
            gamelinkID = token.replace('>', '')
            //some tokens will have a > if its the last token
            //return true to stop iterating
            return true
        }
        //current token is the base of the lichess url
        if (token.includes('lichess.org')) {
            foundBaseURL = true
        }
        return false
    })
    return { gamelinkID: gamelinkID }
}

interface GameValidationResult {
    valid: boolean
    pairing: Pairing | undefined
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

export function validateGameDetails(league: League, details: GameDetails) {
    var result: GameValidationResult = {
        valid: true,
        pairing: null,
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
    var options = league.gamelinks
    if (!isDefined(options)) {
        result.valid = false
        return result
    }

    var white = details.players.white.userId
    var black = details.players.black.userId

    var potentialPairings = league.findPairing(white, black)
    var pairing = (result.pairing = _.head(potentialPairings))
    if (potentialPairings.length === 0) {
        result.valid = false
        result.pairingWasNotFound = true
        result.reason = 'the pairing was not found.'
    } else if (
        !details.clock || // no clock - unlimited or coorespondence
        (details.clock && //clock
            (!_.isEqual(details.clock.initial, options.clock.initial * 60) || // initial time
                !_.isEqual(details.clock.increment, options.clock.increment))) // increment
    ) {
        //the time control does not match options
        result.valid = false
        result.timeControlIsIncorrect = true
        result.reason = 'the time control is incorrect.'
    } else if (
        potentialPairings.length === 1 &&
        pairing &&
        _.isEqual(_.toLower(pairing.white), black)
    ) {
        result.valid = false
        result.colorsAreReversed = true
        result.reason = 'the colors are reversed.'
    } else if (!_.isEqual(details.rated, options.rated)) {
        //the game is not rated correctly
        result.valid = false
        result.gameIsUnrated = true
        result.reason = 'the game is ' + (options.rated ? 'unrated.' : 'rated.')
    } else if (!_.isEqual(details.variant, options.variant)) {
        //the variant does not match
        result.valid = false
        result.variantIsIncorrect = true
        result.reason = 'the variant should be standard.'
    } else if (_.isEqual(details.status, TIMEOUT)) {
        //claim victory is not allowed
        result.valid = false
        result.claimVictoryNotAllowed = true
        result.reason = 'using "Claim Victory" is not permitted. Contact a mod.'
    } else if (_.isEqual(details.status, CHEAT)) {
        // Cheating is not allowed.
        result.valid = false
        result.cheatDetected = true
        result.reason = 'The game ended with a "Cheat Detected". Contact a mod.'
    } else {
        //the link is too old or too new
        var extrema = scheduling.getRoundExtrema(options)
        var game_start = moment.utc(details.createdAt)
        if (
            game_start.isBefore(extrema.start) ||
            game_start.isAfter(extrema.end)
        ) {
            result.valid = false
            result.gameOutsideOfCurrentRound = true
            result.reason = 'the game was not played in the current round.'
        }
    }
    return result
}

//given a gamelinkID, use the lichess api to get the game details
//pass the details to the callback as a JSON object
export function fetchGameDetails(gamelinkID: string) {
    return http.fetchURLIntoJSON('https://lichess.org/api/game/' + gamelinkID)
}

function gamelinkReplyInvalid(
    bot: SlackBot,
    message: CommandMessage,
    reason: string
) {
    bot.reply(
        message,
        'I am sorry, <@' +
            message.user +
            '>,  ' +
            'your post is *not valid* because ' +
            '*' +
            reason +
            '*'
    )
    bot.reply(
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

function validateUserResult(details: HeltourResultDetails, result: Result) {
    //if colors are reversed, in the game link, we will catch that later
    //we know the players are correct or we would not already be here
    //the only way we can validate the result is if the order is 100% correct.
    var validity = {
        valid: true,
        reason: '',
    }
    if (details.winner && _.isEqual(result.result, '1/2-1/2')) {
        //the details gave a winner but the user claimed draw
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
        //the details gave the winner as black but the user claimed white
        validity.reason =
            'the user claimed a win for white ' +
            'but the gamelink specifies black as the winner.'
        validity.valid = false
    } else if (
        _.isEqual(details.winner, 'white') &&
        _.isEqual(result.result, '0-1')
    ) {
        //the details gave the winner as white but the user claimed black
        validity.reason =
            'the user claimed a win for black ' +
            'but the gamelink specifies white as the winner.'
        validity.valid = false
    } else if (
        _.isEqual(details.status, 'draw') &&
        !_.isEqual(result.result, '1/2-1/2')
    ) {
        //the details gave a draw but the user did not claim a draw
        validity.reason =
            'the user claimed a decisive result ' +
            'but the gamelink specifies a draw.'
        validity.valid = false
    }
    return validity
}

function processGamelink(
    bot: SlackBot,
    message: CommandMessage,
    gamelink: string,
    userResult?: HeltourUserResult
) {
    //get the gamelink id if one is in the message
    var result = parseGamelink(gamelink)
    if (!isDefined(result.gamelinkID)) {
        //no gamelink found. we can ignore this message
        return
    }
    //get the game details
    return fetchGameDetails(result.gamelinkID)
        .then(response => {
            var details = response['json']
            //validate the game details vs the user specified result
            if (isDefined(userResult)) {
                var validity = validateUserResult(details, userResult)
                if (!validity.valid) {
                    gamelinkReplyInvalid(bot, message, validity.reason)
                    return
                }
            }
            return processGameDetails(bot, message, details)
        })
        .catch(error => {
            winston.error(JSON.stringify(error))
            bot.reply(
                message,
                'Sorry, I failed to get game details for ' +
                    gamelink +
                    '. Try again later or reach out to a moderator to make the update manually.'
            )
        })
}

function processGameDetails(
    bot: SlackBot,
    message: CommandMessage,
    details: HeltourResultDetails
) {
    if (!isDefined(message.league)) {
        return
    }
    //if no details were found the link was no good
    if (!details) {
        gamelinkReplyUnknown(bot, message)
        return
    }

    //verify the game meets the requirements of the channel we are in
    var validity = validateGameDetails(message.league, details)
    if (!validity.valid) {
        //game was not valid
        gamelinkReplyInvalid(bot, message, validity.reason)
        return
    }
    return updateGamelink(message.league, details)
        .then(function(updatePairingResult) {
            resultReplyUpdated(bot, message, updatePairingResult)
        })
        .catch(function(error) {
            if (error instanceof heltour.HeltourError) {
                handleHeltourErrors(bot, message, error.code)
            } else {
                winston.error(JSON.stringify(error))
            }
        })
}

export async function updateGamelink(
    league: League,
    details: HeltourResultDetails
) {
    var result: HeltourResultPost = {}
    //our game is valid
    //get players to update the result in the sheet
    var white = details.players.white
    var black = details.players.black
    result.white = league.bot.users.getByNameOrID(white.userId)
    result.black = league.bot.users.getByNameOrID(black.userId)
    result.gamelinkID = details.id
    result.gamelink = 'https://lichess.org/' + result.gamelinkID

    //get the result in the correct format
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

    //gamelinks only come from played games, so ignoring forfeit result types

    //update the website with results from gamelink
    return heltour
        .updatePairing(league.heltour, result)
        .then(function(updatePairingResult) {
            if (updatePairingResult['error']) {
                //if there was a problem with heltour, we should not take further steps
                throw new heltour.HeltourError(updatePairingResult['error'])
            }

            var leagueName = league.name
            var white = result.white
            var black = result.black
            if (
                updatePairingResult['resultChanged'] &&
                !_.isEmpty(updatePairingResult.result)
            ) {
                // TODO: Test this.
                subscription.emitter.emit(
                    'a-game-is-over',
                    league,
                    [white.name, black.name],
                    {
                        result: updatePairingResult,
                        white: white,
                        black: black,
                        leagueName: leagueName,
                    }
                )
            } else if (updatePairingResult['gamelinkChanged']) {
                // TODO: Test this.
                subscription.emitter.emit(
                    'a-game-starts',
                    league,
                    [white.name, black.name],
                    {
                        result: result,
                        white: white,
                        black: black,
                        leagueName: leagueName,
                    }
                )
            }
            return updatePairingResult
        })
}

export function ambientGamelinks(bot: SlackBot, message: CommandMessage) {
    if (!message.league) {
        return
    }
    var channel = bot.channels.byId[message.channel.id]
    if (!channel) {
        return
    }
    var gamelinkOptions = message.league.gamelinks
    if (!gamelinkOptions || !_.isEqual(channel.name, gamelinkOptions.channel)) {
        return
    }
    var heltourOptions = message.league.heltour
    if (!heltourOptions) {
        winston.error(
            `[GAMELINK] ${message.league.name} league doesn't have heltour options!?`
        )
        return
    }

    try {
        return processGamelink(bot, message, message.text)
    } catch (e) {
        //at the moment, we do not throw from inside the api - rethrow
        throw e
    }
}

