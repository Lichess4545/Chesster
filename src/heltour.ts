//------------------------------------------------------------------------------
// Heltour related facilities
//------------------------------------------------------------------------------
import _ from 'lodash'
import moment from 'moment'
import url from 'url'
import * as http from './http'
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
} from 'type-safe-json-decoder'

export interface Config {
    token: string
    baseEndpoint: string
    leagueTag: string
}

//------------------------------------------------------------------------------
// Error
//------------------------------------------------------------------------------
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

//------------------------------------------------------------------------------
// Schedule
//------------------------------------------------------------------------------
export interface UpdateScheduleRequest {
    white: string
    black: string
    date: moment.Moment
}

//------------------------------------------------------------------------------
// Pairings
//------------------------------------------------------------------------------
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
// Pairings
//------------------------------------------------------------------------------

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
    game_link_changed: boolean
    result_changed: boolean
    reversed: boolean
}
export const UpdatePairingResultDecoder: Decoder<UpdatePairingResult> = object(
    ['updated', number()],
    ['white', string()],
    ['black', string()],
    ['game_link_changed', boolean()],
    ['result_changed', boolean()],
    ['reversed', boolean()],
    (updated, white, black, game_link_changed, result_changed, reversed) => ({
        updated,
        white,
        black,
        game_link_changed,
        result_changed,
        reversed,
    })
)

//------------------------------------------------------------------------------
// Rosters
//------------------------------------------------------------------------------
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
    is_captain: boolean
    board_number: number
}
export const TeamPlayerDecoder: Decoder<TeamPlayer> = object(
    ['username', string()],
    ['is_captain', boolean()],
    ['board_number', number()],
    (username, is_captain, board_number) => ({
        username,
        is_captain,
        board_number,
    })
)
export interface Team {
    name: string
    number: number
    slack_channel: string
    players: TeamPlayer[]
}
export const TeamDecoder: Decoder<Team> = object(
    ['name', string()],
    ['number', number()],
    ['slack_channel', string()],
    ['players', array(TeamPlayerDecoder)],
    (name, number, slack_channel, players) => ({
        name,
        number,
        slack_channel,
        players,
    })
)
export interface BoardAlternates {
    board_number: number
    usernames: string[]
}
export const BoardAlternatesDecoder: Decoder<BoardAlternates> = object(
    ['board_number', number()],
    ['usernames', array(string())],
    (board_number, usernames) => ({ board_number, usernames })
)
export interface Roster {
    league: string
    season: string
    players: Player[]
    teams: Team[]
    alternates: BoardAlternates[]
}
export const RosterDecoder: Decoder<Roster> = object(
    ['league', string()],
    ['season', string()],
    ['players', array(PlayerDecoder)],
    ['teams', array(TeamDecoder)],
    ['alternates', array(BoardAlternatesDecoder)],
    (league, season, players, teams, alternates) => ({
        league,
        season,
        players,
        teams,
        alternates,
    })
)

//------------------------------------------------------------------------------
// UserMap
//------------------------------------------------------------------------------
export interface UserMap {
    users: Record<string, string>
}
export const UserMapDecoder: Decoder<UserMap> = object(
    ['users', dict(string())],
    (users) => ({ users })
)

//------------------------------------------------------------------------------
// Link Slack
//------------------------------------------------------------------------------
export interface SlackLink {
    url: string
    already_linked: string[]
    expires: string
}
export const SlackLinkDecoder: Decoder<SlackLink> = object(
    ['url', string()],
    ['already_linked', array(string())],
    ['expires', string()],
    (url, already_linked, expires) => ({ url, already_linked, expires })
)

//------------------------------------------------------------------------------
// UpdateSucceeded
//------------------------------------------------------------------------------
export interface UpdateSucceeded {
    updated: number
}
export const UpdateSucceededDecoder: Decoder<UpdateSucceeded> = object(
    ['updated', number()],
    (updated) => ({ updated })
)

//------------------------------------------------------------------------------
// League Moderators
//------------------------------------------------------------------------------
export interface LeagueModerators {
    moderators: string[]
}
export const LeagueModeratorsDecoder: Decoder<LeagueModerators> = object(
    ['moderators', array(string())],
    (moderators) => ({ moderators })
)

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

async function heltourApiCall<T extends object>(
    request: http.RequestOptions,
    decoder: Decoder<T>
) {
    let response = await http.fetchURL(request)
    let result = union(ErrorDecoder, decoder).decodeJSON(response.body)
    if (!isValid<T>(result)) {
        throw new HeltourError(result.error)
    }
    return result
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
    var request = heltourRequest(heltourConfig, 'find_pairing')
    request.parameters = {
        league: leagueTag,
    }
    return heltourApiCall(request, PairingsDecoder)
}

// Update the schedule
export async function updateSchedule(
    heltourConfig: Config,
    schedule: UpdateScheduleRequest
) {
    var request = heltourRequest(heltourConfig, 'update_pairing')
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
    heltourConfig: Config,
    result: UpdatePairingRequest
) {
    let pairings = await findPairing(
        heltourConfig,
        result.white.name,
        result.black.name
    )
    if (pairings.length < 1) {
        throw new HeltourError('no_pairing')
    } else if (pairings.length > 1) {
        throw new HeltourError('ambiguous')
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
    if (result.game_link) {
        request.bodyParameters['game_link'] = result.game_link
    }

    let response = await http.fetchURL(request)
    let heltourResult = union(
        ErrorDecoder,
        UpdatePairingResultDecoder
    ).decodeJSON(response.body)
    if (!isValid(heltourResult)) {
        throw new HeltourError(heltourResult.error)
    }
    if (heltourResult.reversed) {
        let white = heltourResult.white
        heltourResult.white = heltourResult.black
        heltourResult.black = white
    }
    return heltourResult
}

export async function getRoster(heltourConfig: Config, leagueTag: string) {
    var request = heltourRequest(heltourConfig, 'get_roster')
    request.parameters = {
        league: leagueTag,
    }
    return heltourApiCall(request, RosterDecoder)
}

export async function getUserMap(heltourConfig: Config): Promise<UserMap> {
    var request = heltourRequest(heltourConfig, 'get_slack_user_map')
    request.parameters = {}
    return heltourApiCall(request, UserMapDecoder)
}

export async function linkSlack(
    heltourConfig: Config,
    user_id: string,
    display_name: string
) {
    var request = heltourRequest(heltourConfig, 'link_slack')
    request.parameters = { user_id: user_id, display_name: display_name }
    return heltourApiCall(request, SlackLinkDecoder)
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
    return heltourApiCall(request, UpdateSucceededDecoder)
}

export async function getLeagueModerators(heltourConfig: Config) {
    var request = heltourRequest(heltourConfig, 'get_league_moderators')
    request.parameters = {
        league: heltourConfig.leagueTag,
    }
    return heltourApiCall(request, LeagueModeratorsDecoder)
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
    return heltourApiCall(request, UpdateSucceededDecoder)
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
    return heltourApiCall(request, UpdateSucceededDecoder)
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
    return heltourApiCall(request, UpdateSucceededDecoder)
}

export class HeltourError {
    name = 'HeltourError'
    stack: string | undefined
    constructor(public code: string) {
        this.stack = new Error().stack
    }
}
