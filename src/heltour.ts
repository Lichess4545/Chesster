//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------
import _ from 'lodash'
import moment from 'moment'
import url from 'url'
import * as http from './http'
import winston from 'winston'
import {
    Decoder,
    at,
    array,
    object,
    number,
    string,
    andThen,
    oneOf,
    union,
} from 'type-safe-json-decoder'

// TODO: Fix all of these
type Schedule = any
type Result = any

export interface Config {
    token: string
    baseEndpoint: string
    leagueTag: string
}

export interface Error {
    error: string
}
export const ErrorDecoder: Decoder<Error> = object(
    ['error', string()],
    (error) => ({ error })
)
export function isValid<T extends object>(obj: T | Error): obj is T {
    return !obj.hasOwnProperty('error')
}

export interface IndividualPairing {
    league: string
    season: string
    round: number
    white: string
    white_rating: number
    black: string
    black_rating: number
    game_link?: string
    result: string
    datetime: moment.Moment
}

export const IndividualPairingDecoder: Decoder<IndividualPairing> = object(
    ['league', string()],
    ['season', string()],
    ['round', number()],
    ['white', string()],
    ['white_rating', number()],
    ['black', string()],
    ['black_rating', number()],
    ['game_link', string()],
    ['result', string()],
    ['datetime', string()],
    (
        league,
        season,
        round,
        white,
        white_rating,
        black,
        black_rating,
        game_link,
        result,
        datetime
    ) => ({
        league,
        season,
        round,
        white,
        white_rating,
        black,
        black_rating,
        game_link,
        result,
        datetime: moment(datetime),
    })
)

export interface TeamPairing extends IndividualPairing {
    white_team: string
    white_team_number: number
    black_team: string
    black_team_number: number
}
export const TeamPairingDecoder: Decoder<TeamPairing> = andThen(
    IndividualPairingDecoder,
    (pairing: IndividualPairing) => {
        return object(
            ['white_team', string()],
            ['white_team_number', number()],
            ['black_team', string()],
            ['black_team_number', number()],
            (white_team, white_team_number, black_team, black_team_number) => ({
                ...pairing,
                white_team,
                white_team_number,
                black_team,
                black_team_number,
            })
        )
    }
)
export const PairingDecoder: Decoder<Pairing> = oneOf(
    TeamPairingDecoder,
    IndividualPairingDecoder
)

export const PairingsDecoder: Decoder<Pairing[]> = at(
    ['pairings'],
    array(PairingDecoder)
)

export type Pairing = IndividualPairing | TeamPairing
export function isIndividualPairing(obj: Pairing): obj is IndividualPairing {
    return !obj.hasOwnProperty('white_team')
}
export function isTeamPairing(obj: Pairing): obj is TeamPairing {
    return obj.hasOwnProperty('white_team')
}

//------------------------------------------------------------------------------
export function heltourRequest(
    heltourConfig: Config,
    endpoint: string
): http.RequestOptions {
    var request = url.parse(`${heltourConfig.baseEndpoint}${endpoint}/`)
    return {
        ...request,
        headers: {
            Authorization: 'Token ' + heltourConfig.token,
        },
    }
}

/*
 * takes an optional leagueTag, rather than using the league
 * specified in heltour config so you can choose all leagues
 * or one in particular.
 */
export async function findPairing(
    heltourConfig: Config,
    white: string,
    black: string,
    leagueTag?: string
) {
    var request = heltourRequest(heltourConfig, 'find_pairing')
    request.parameters = {
        white: white,
        black: black,
    }
    if (!_.isNil(leagueTag)) {
        request.parameters.league = leagueTag
    }

    let response = await http.fetchURL(request)
    let result = union(ErrorDecoder, PairingsDecoder).decodeJSON(response.body)
    if (!isValid(result)) {
        throw new HeltourError(result.error)
    }
    return result
}

/*
 * Note that this method is similar to the one above and they are probably
 * candidates to be refactored together, but this one supports the
 * refreshCurrentSchedules which gets all of the pairings for the league
 *
 * I wasn't sure how to merge the two concepts into a coherent API
 */
export async function getAllPairings(
    heltourConfig: Config,
    leagueTag: string
): Promise<Pairing[]> {
    var request = heltourRequest(heltourConfig, 'find_pairing')
    request.parameters = {}
    return new Promise((resolve, reject) => {
        if (!_.isNil(leagueTag)) {
            request.parameters = request.parameters || {}
            request.parameters.league = leagueTag
        } else {
            return reject(
                'leagueTag is a required parameter for heltour.getAllPairings'
            )
        }

        http.fetchURLIntoJSON(request)
            .then((response) => {
                var pairings = response['json']
                if (!_.isNil(pairings.error)) {
                    reject(pairings.error)
                } else {
                    if (!_.isNil(pairings.pairings)) {
                        resolve(pairings.pairings)
                    } else {
                        winston.error(`Error getting pairings for ${leagueTag}`)
                        reject('No Pairings')
                    }
                }
            })
            .catch(reject)
    })
}

// Update the schedule
export async function updateSchedule(
    heltourConfig: Config,
    schedule: Schedule
) {
    var request = heltourRequest(heltourConfig, 'update_pairing')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        white: schedule.white,
        black: schedule.black,
        datetime: schedule.date.format(),
    }

    return http.fetchURLIntoJSON(request)
}

// Update the pairing with a result or link
export async function updatePairing(heltourConfig: Config, result: Result) {
    let pairings = await findPairing(
        heltourConfig,
        result.white.name,
        result.black.name
    )
    if (pairings.length < 1) {
        return {
            error: 'no_pairing',
        }
    } else if (pairings.length > 1) {
        return {
            error: 'ambiguous',
        }
    }
    var request = heltourRequest(heltourConfig, 'update_pairing')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        white: result.white.name,
        black: result.black.name,
    }
    if (result.result) {
        request.bodyParameters['result'] = result.result
    }
    if (result.gamelink) {
        request.bodyParameters['game_link'] = result.gamelink
    }

    return http.fetchURLIntoJSON(request).then(function (response) {
        var newResult = response['json']
        newResult['gamelink'] = result['gamelink']
        newResult['gamelinkChanged'] = newResult['game_link_changed']
        newResult['resultChanged'] = newResult['result_changed']
        newResult['result'] = result['result']
        if (newResult['reversed']) {
            newResult['white'] = result['black']
            newResult['black'] = result['white']
        } else {
            newResult['white'] = result['white']
            newResult['black'] = result['black']
        }
        return newResult
    })
}

export async function getRoster(heltourConfig: Config, leagueTag: string) {
    return new Promise((resolve, reject) => {
        var request = heltourRequest(heltourConfig, 'get_roster')
        request.parameters = {}
        if (!_.isNil(leagueTag)) {
            request.parameters.league = leagueTag
        } else {
            return reject(
                'leagueTag is a required parameter for heltour.getRoster'
            )
        }
        http.fetchURLIntoJSON(request)
            .then(function (result) {
                var roster = result['json']
                if (!_.isNil(roster.error)) {
                    winston.error(`Error getting rosters: ${roster.error}`)
                    reject(roster.error)
                } else {
                    resolve(roster)
                }
            })
            .catch(function (error) {
                winston.error(`Unable to getRoster: ${error}`)
                reject(error)
            })
    })
}

export async function getUserMap(
    heltourConfig: Config
): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        var request = heltourRequest(heltourConfig, 'get_slack_user_map')
        request.parameters = {}
        http.fetchURLIntoJSON(request)
            .then(function (result) {
                resolve(result['json'].users)
            })
            .catch(function (error) {
                winston.error(`Unable to getSlackUserMap: ${error}`)
                reject(error)
            })
    })
}

export async function linkSlack(
    heltourConfig: Config,
    user_id: string,
    display_name: string
) {
    return new Promise((resolve, reject) => {
        var request = heltourRequest(heltourConfig, 'link_slack')
        request.parameters = { user_id: user_id, display_name: display_name }
        http.fetchURLIntoJSON(request)
            .then(function (result) {
                resolve(result['json'])
            })
            .catch(function (error) {
                winston.error(`Unable to linkSlack: ${error}`)
                reject(error)
            })
    })
}

export async function assignAlternate(
    heltourConfig: Config,
    round: number,
    team: number,
    board: number,
    player: string
) {
    var request = heltourRequest(heltourConfig, 'assign_alternate')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        round: round,
        team: team,
        board: board,
        player: player,
    }
    return fetchJSONandHandleErrors(request)
}

export async function getLeagueModerators(heltourConfig: Config) {
    var request = heltourRequest(heltourConfig, 'get_league_moderators')
    request.parameters = {
        league: heltourConfig.leagueTag,
    }
    return fetchJSONandHandleErrors(request).then((json) => json['moderators'])
}

export async function setAvailability(
    heltourConfig: Config,
    playerName: string,
    available: boolean,
    roundNumber: number
) {
    var request = heltourRequest(heltourConfig, 'set_availability')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        player: playerName,
        round: roundNumber,
        available: available,
    }
    return fetchJSONandHandleErrors(request)
}

export async function sendGameWarning(
    heltourConfig: Config,
    white: string,
    black: string,
    reason: string
) {
    var request = heltourRequest(heltourConfig, 'game_warning')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        white: white,
        black: black,
        reason: reason,
    }
    return http.fetchURLIntoJSON(request)
}

export async function playerContact(
    heltourConfig: Config,
    sender: string,
    recip: string
) {
    var request = heltourRequest(heltourConfig, 'player_contact')
    request.method = 'POST'
    request.bodyParameters = {
        sender: sender,
        recip: recip,
    }
    return http.fetchURLIntoJSON(request)
}

export async function fetchJSONandHandleErrors(request: http.RequestOptions) {
    return http.fetchURLIntoJSON(request).then(function (response) {
        if (response['json']['error']) {
            throw new Error(response['json']['error'])
        }
        return response['json']
    })
}

export class HeltourError {
    name = 'HeltourError'
    stack: string | undefined
    constructor(public code: string) {
        this.stack = new Error().stack
    }
}
