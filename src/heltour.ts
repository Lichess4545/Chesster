// -----------------------------------------------------------------------------
// Heltour related facilities
// -----------------------------------------------------------------------------
import _ from 'lodash'
import winston from 'winston'
import moment from 'moment'
import { parse } from 'url'
import * as http from './http'
import {
    Heltour as Config,
    HeltourLeagueConfig as LeagueConfig,
} from './config'
import {
    Decoder,
    at,
    array,
    object,
    number,
    string,
    boolean,
    andThen,
    oneOf,
    union,
    dict,
    equal,
    succeed,
} from 'type-safe-json-decoder'

// -----------------------------------------------------------------------------
// Error
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// Schedule
// -----------------------------------------------------------------------------
export interface UpdateScheduleRequest {
    white: string
    black: string
    date: moment.Moment
}

// -----------------------------------------------------------------------------
// Pairings
// -----------------------------------------------------------------------------
export interface IndividualPairing {
    league: string
    season: string
    round: number
    white: string
    whiteRating: number
    black: string
    blackRating: number
    gameLink?: string
    result: string
    datetime?: moment.Moment
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
    ['datetime', oneOf(string(), equal(null))],
    (
        league,
        season,
        round,
        white,
        whiteRating,
        black,
        blackRating,
        gameLink,
        result,
        datetime
    ) => ({
        league,
        season,
        round,
        white,
        whiteRating,
        black,
        blackRating,
        gameLink,
        result,
        datetime: datetime ? moment.utc(datetime) : undefined,
    })
)

export interface TeamPairing extends IndividualPairing {
    whiteTeam: string
    whiteTeamNumber: number
    blackTeam: string
    blackTeamNumber: number
}
export const TeamPairingDecoder: Decoder<TeamPairing> = andThen(
    IndividualPairingDecoder,
    (pairing: IndividualPairing) => {
        return object(
            ['white_team', string()],
            ['white_team_number', number()],
            ['black_team', string()],
            ['black_team_number', number()],
            (whiteTeam, whiteTeamNumber, blackTeam, blackTeamNumber) => ({
                ...pairing,
                whiteTeam,
                whiteTeamNumber,
                blackTeam,
                blackTeamNumber,
            })
        )
    }
)
export const PairingDecoder: Decoder<Pairing> = oneOf(
    TeamPairingDecoder,
    IndividualPairingDecoder
)

export const NullPairingsDecoder: Decoder<Pairing[]> = andThen(
    at(['pairings'], equal(null)),
    () => succeed([])
)

export const HasPairingsDecoder: Decoder<Pairing[]> = at(
    ['pairings'],
    array(PairingDecoder)
)

export const PairingsDecoder: Decoder<Pairing[]> = oneOf(
    HasPairingsDecoder,
    NullPairingsDecoder
)

export type Pairing = IndividualPairing | TeamPairing
export function isIndividualPairing(obj: Pairing): obj is IndividualPairing {
    return !obj.hasOwnProperty('white_team')
}
export function isTeamPairing(obj: Pairing): obj is TeamPairing {
    return obj.hasOwnProperty('white_team')
}

// -----------------------------------------------------------------------------
// Pairings
// -----------------------------------------------------------------------------

export interface User {
    name: string
}
export interface UpdatePairingRequest {
    white: User
    black: User
    game_link?: string
    result: string
}

export interface UpdatePairingResult {
    updated: number
    white: string
    black: string
    gameLinkChanged: boolean
    resultChanged: boolean
    reversed: boolean
}
export const UpdatePairingResultDecoder: Decoder<UpdatePairingResult> = object(
    ['updated', number()],
    ['white', string()],
    ['black', string()],
    ['game_link_changed', boolean()],
    ['result_changed', boolean()],
    ['reversed', boolean()],
    (updated, white, black, gameLinkChanged, resultChanged, reversed) => ({
        updated,
        white,
        black,
        gameLinkChanged,
        resultChanged,
        reversed,
    })
)

// -----------------------------------------------------------------------------
// Rosters
// -----------------------------------------------------------------------------
export interface Player {
    username: string
    rating: number
}
export const PlayerDecoder: Decoder<Player> = object(
    ['username', string()],
    ['rating', number()],
    (username, rating) => ({ username, rating })
)
export interface TeamPlayer {
    username: string
    isCaptain: boolean
    boardNumber: number
}
export const TeamPlayerDecoder: Decoder<TeamPlayer> = object(
    ['username', string()],
    ['is_captain', boolean()],
    ['board_number', number()],
    (username, isCaptain, boardNumber) => ({
        username,
        isCaptain,
        boardNumber,
    })
)
export interface Team {
    name: string
    num: number
    slackChannel: string
    players: TeamPlayer[]
}
export const TeamDecoder: Decoder<Team> = object(
    ['name', string()],
    ['number', number()],
    ['slack_channel', string()],
    ['players', array(TeamPlayerDecoder)],
    (name, num, slackChannel, players) => ({
        name,
        num,
        slackChannel,
        players,
    })
)
export interface BoardAlternates {
    boardNumber: number
    usernames: string[]
}
export const BoardAlternatesDecoder: Decoder<BoardAlternates> = object(
    ['board_number', number()],
    ['usernames', array(string())],
    (boardNumber, usernames) => ({ boardNumber, usernames })
)
export interface IndividualLeagueRoster {
    league: string
    season: string
    players: Player[]
}
export const IndividualLeagueRosterDecoder: Decoder<IndividualLeagueRoster> = object(
    ['league', string()],
    ['season', string()],
    ['players', array(PlayerDecoder)],
    (league, season, players) => ({
        league,
        season,
        players,
    })
)
export interface TeamLeagueRoster extends IndividualLeagueRoster {
    league: string
    season: string
    players: Player[]
    teams: Team[]
    alternates: BoardAlternates[]
}
export const TeamLeagueRosterDecoder: Decoder<TeamLeagueRoster> = andThen(
    IndividualLeagueRosterDecoder,
    (baseRoster: IndividualLeagueRoster) =>
        object(
            ['teams', array(TeamDecoder)],
            ['alternates', array(BoardAlternatesDecoder)],
            (teams, alternates) => ({
                ...baseRoster,
                teams,
                alternates,
            })
        )
)
export type Roster = IndividualLeagueRoster | TeamLeagueRoster
export const RosterDecoder: Decoder<Roster> = oneOf(
    TeamLeagueRosterDecoder,
    IndividualLeagueRosterDecoder
)
export function isTeamLeagueRoster(roster: Roster): roster is TeamLeagueRoster {
    return roster.hasOwnProperty('teams')
}

// -----------------------------------------------------------------------------
// UserMap
// -----------------------------------------------------------------------------
export type UserMap = Record<string, string>
export const UserMapDecoder: Decoder<UserMap> = at(['users'], dict(string()))

// -----------------------------------------------------------------------------
// Link Slack
// -----------------------------------------------------------------------------
export interface SlackLink {
    url: string
    alreadyLinked: string[]
    expires: string
}
export const SlackLinkDecoder: Decoder<SlackLink> = object(
    ['url', string()],
    ['already_linked', array(string())],
    ['expires', string()],
    (url, alreadyLinked, expires) => ({ url, alreadyLinked, expires })
)

// -----------------------------------------------------------------------------
// UpdateSucceeded
// -----------------------------------------------------------------------------
export interface UpdateSucceeded {
    updated: number
}
export const UpdateSucceededDecoder: Decoder<UpdateSucceeded> = object(
    ['updated', number()],
    (updated) => ({ updated })
)

// -----------------------------------------------------------------------------
// League Moderators
// -----------------------------------------------------------------------------
export type LeagueModerators = string[]
export const LeagueModeratorsDecoder: Decoder<LeagueModerators> = at(
    ['moderators'],
    array(string())
)

// -----------------------------------------------------------------------------
export function heltourRequest(
    heltourConfig: Config,
    endpoint: string
): http.RequestOptions {
    const request = parse(`${heltourConfig.baseEndpoint}${endpoint}/`)
    return {
        ...request,
        headers: {
            Authorization: 'Token ' + heltourConfig.token,
        },
    }
}

async function heltourApiCall<T extends object>(
    request: http.RequestOptions,
    decoder: Decoder<T>
): Promise<T> {
    const response = await http.fetchURL(request)
    try {
        const result = union(decoder, ErrorDecoder).decodeJSON(response.body)
        if (!isValid<T>(result)) {
            throw new HeltourError(result.error)
        }
        return result
    } catch (error) {
        winston.error(
            `[HELTOUR] Unable to make API request for ${JSON.stringify(
                request
            )}: ${error}`
        )
        winston.error(`[HELTOUR] response.body ${response.body}`)
        throw error
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
    const request = heltourRequest(heltourConfig, 'find_pairing')
    request.parameters = { white, black }
    if (!_.isNil(leagueTag)) {
        request.parameters.league = leagueTag
    }
    return heltourApiCall(request, PairingsDecoder)
}

/*
 * Note that this method is similar to the one above and they are probably
 * candidates to be refactored together, but this one supports the
 * refreshCurrentSchedules which gets all of the pairings for the league
 *
 * I wasn't sure how to merge the two concepts into a coherent API
 * TODO: With typescript this should be easier.
 */
export async function getAllPairings(
    heltourConfig: Config,
    leagueTag: string
): Promise<Pairing[]> {
    const request = heltourRequest(heltourConfig, 'find_pairing')
    request.parameters = {
        league: leagueTag,
    }
    return heltourApiCall(request, PairingsDecoder)
}

// Update the schedule
export async function updateSchedule(
    heltourConfig: LeagueConfig,
    schedule: UpdateScheduleRequest
) {
    const request = heltourRequest(heltourConfig, 'update_pairing')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        white: schedule.white,
        black: schedule.black,
        datetime: schedule.date.format(),
    }

    return heltourApiCall(request, UpdatePairingResultDecoder)
}

// Update the pairing with a result or link
export async function updatePairing(
    heltourConfig: LeagueConfig,
    result: UpdatePairingRequest
) {
    const pairings = await findPairing(
        heltourConfig,
        result.white.name,
        result.black.name
    )
    if (pairings.length < 1) {
        throw new HeltourError('no_pairing')
    } else if (pairings.length > 1) {
        throw new HeltourError('ambiguous')
    }
    const request = heltourRequest(heltourConfig, 'update_pairing')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        white: result.white.name,
        black: result.black.name,
    }
    if (result.result) {
        request.bodyParameters.result = result.result
    }
    if (result.game_link) {
        request.bodyParameters.game_link = result.game_link
    }

    const response = await http.fetchURL(request)
    const heltourResult = union(
        ErrorDecoder,
        UpdatePairingResultDecoder
    ).decodeJSON(response.body)
    if (!isValid(heltourResult)) {
        throw new HeltourError(heltourResult.error)
    }
    if (heltourResult.reversed) {
        const white = heltourResult.white
        heltourResult.white = heltourResult.black
        heltourResult.black = white
    }
    return heltourResult
}

export async function getRoster(heltourConfig: Config, leagueTag: string) {
    const request = heltourRequest(heltourConfig, 'get_roster')
    request.parameters = {
        league: leagueTag,
    }
    return heltourApiCall(request, RosterDecoder)
}

export async function getUserMap(heltourConfig: Config): Promise<UserMap> {
    const request = heltourRequest(heltourConfig, 'get_slack_user_map')
    request.parameters = {}
    return heltourApiCall(request, UserMapDecoder)
}

export async function linkSlack(
    heltourConfig: Config,
    userId: string,
    displayName: string
) {
    const request = heltourRequest(heltourConfig, 'link_slack')
    request.parameters = { user_id: userId, display_name: displayName }
    return heltourApiCall(request, SlackLinkDecoder)
}

export async function assignAlternate(
    heltourConfig: LeagueConfig,
    round: number,
    team: number,
    board: number,
    player: string
) {
    const request = heltourRequest(heltourConfig, 'assign_alternate')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        round,
        team,
        board,
        player,
    }
    return heltourApiCall(request, UpdateSucceededDecoder)
}

export async function getLeagueModerators(heltourConfig: LeagueConfig) {
    const request = heltourRequest(heltourConfig, 'get_league_moderators')
    request.parameters = {
        league: heltourConfig.leagueTag,
    }
    return heltourApiCall(request, LeagueModeratorsDecoder)
}

export async function setAvailability(
    heltourConfig: LeagueConfig,
    playerName: string,
    available: boolean,
    roundNumber: number
) {
    const request = heltourRequest(heltourConfig, 'set_availability')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        player: playerName,
        round: roundNumber,
        available,
    }
    return heltourApiCall(request, UpdateSucceededDecoder)
}

export async function sendGameWarning(
    heltourConfig: LeagueConfig,
    white: string,
    black: string,
    reason: string
) {
    const request = heltourRequest(heltourConfig, 'game_warning')
    request.method = 'POST'
    request.bodyParameters = {
        league: heltourConfig.leagueTag,
        white,
        black,
        reason,
    }
    return heltourApiCall(request, UpdateSucceededDecoder)
}

export async function playerContact(
    heltourConfig: Config,
    sender: string,
    recip: string
) {
    const request = heltourRequest(heltourConfig, 'player_contact')
    request.method = 'POST'
    request.bodyParameters = { sender, recip }
    return heltourApiCall(request, UpdateSucceededDecoder)
}

export class HeltourError {
    name = 'HeltourError'
    stack: string | undefined
    constructor(public code: string) {
        this.stack = new Error().stack
    }
}
