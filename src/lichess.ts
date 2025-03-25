// -----------------------------------------------------------------------------
// Lichess API helpers
// -----------------------------------------------------------------------------
import * as http from './http'
import moment from 'moment-timezone'
import _ from 'lodash'
import winston from 'winston'
import {
    Decoder,
    object,
    number,
    string,
    boolean,
    oneOf,
    andThen,
    equal,
    succeed,
} from 'type-safe-json-decoder'
// TODO: sequelize-cli requires us to call this models.js or models/index.js
//       this name conflicts with the parameter that we pass in after getting
//       the lock, so I'd like to (by convention) always refer to this as db.
import * as db from './models'
import { ResultsEnum } from './league'
import { isDefined } from './utils'

const MILISECOND = 1
const SECONDS = 1000 * MILISECOND

export type LichessID = string
export type LichessName = string

type QueuedRequest = {
    url: string
    isJSON: boolean
    accept?: string
    resolve: (value?: any) => void
    reject: (reason?: any) => void
}

// -----------------------------------------------------------------------------
// A lichess API queue.
//
// Provides two queues, a background queue and main queue. Use the main queue
// for any processing in response to a user message, as the main queue takes
// priority.
//
// Use the background queue for any background updating, like player ratings.
//
// Also attempts to rate limit itself according to the lichess API guidelines
// a max of one request every 2 seconds (this is actually a bit slower), and
// it will wait a minute if it receives a 429.
// -----------------------------------------------------------------------------
const { makeRequest, startRequests, stopRequests } = (() => {
    // The background queue will be processed when there is nothing else to process
    const backgroundQueue: QueuedRequest[] = []
    // The mainQueue will be processed first.
    const mainQueue: QueuedRequest[] = []
    let stop = false
    async function _makeRequest(
        url: string,
        isJSON: boolean,
        isBackground: boolean,
        accept?: string
    ): Promise<http.Response> {
        return new Promise((resolve, reject) => {
            if (isBackground) {
                backgroundQueue.push({ url, isJSON, resolve, reject, accept })
            } else {
                mainQueue.push({ url, isJSON, resolve, reject, accept })
            }
        })
    }
    function _stopRequests() {
        stop = true
    }
    function _startRequests() {
        stop = false
        processRequests()
    }
    function processRequests() {
        if (stop) return
        let request = null
        // The default delay between requests is 2 seconds
        let requestDelay = 0
        if (mainQueue.length > 0 || backgroundQueue.length > 0) {
            winston.info(
                `[LICHESS] ${mainQueue.length} requests in mainQueue ` +
                    `${backgroundQueue.length} requests in backgroundQueue`
            )
        }
        if (mainQueue.length > 0) {
            request = mainQueue.shift()
        } else if (backgroundQueue.length > 0) {
            request = backgroundQueue.shift()
        }
        if (request) {
            const url = request.url
            const isJSON = request.isJSON
            const resolve = request.resolve
            const reject = request.reject
            const accept = request.accept
            let promise = null
            try {
                const options = http.requestFromString(url)
                if (accept) {
                    options.headers = options.headers || {}
                    options.headers.Accept = accept
                }
                promise = http.fetchURL(options)
                promise.then(
                    (result) => {
                        try {
                            if (result.response.statusCode === 429) {
                                requestDelay = 60 * SECONDS
                                winston.info(
                                    '[LICHESS] Last request status was a 429 - we will wait 60 seconds before our next request'
                                )
                            } else {
                                if (
                                    mainQueue.length + backgroundQueue.length >
                                    0
                                ) {
                                    requestDelay = 0
                                } else {
                                    // Back off a little bit if we don't have any requests
                                    requestDelay = 0.05
                                }
                                if (isJSON) {
                                    const json = JSON.parse(result.body)
                                    if (json) {
                                        resolve({ ...result, json })
                                    } else {
                                        winston.error(
                                            "[LICHESS] Asked for JSON - but didn't get it"
                                        )
                                        winston.error(
                                            '[LICHESS] ' +
                                                JSON.stringify(result)
                                        )
                                        reject('Not JSON')
                                    }
                                } else {
                                    resolve(result)
                                }
                            }
                            setTimeout(processRequests, requestDelay)
                        } catch (e) {
                            winston.error('[LICHESS] Exception: ' + e)
                            // @ts-ignore - this was getting in my way when trying to build chesster locally
                            winston.error('[LICHESS] Stack: ' + e.stack)
                            winston.error('[LICHESS] URL: ' + url)
                            reject(e)
                            setTimeout(processRequests, requestDelay)
                        }
                    },
                    (error) => {
                        winston.error(
                            `[LICHESS] Request failed: ${JSON.stringify(error)}`
                        )
                        setTimeout(processRequests, requestDelay)
                        reject(error)
                    }
                )
            } catch (e) {
                winston.error('[LICHESS] Exception: ' + e)
                // @ts-ignore - this was getting in my way when trying to build chesster locally
                winston.error('[LICHESS] Stack: ' + e.stack)
                reject(e)
                setTimeout(processRequests, requestDelay)
            }
        } else {
            setTimeout(processRequests, requestDelay)
        }
    }
    return {
        makeRequest: _makeRequest,
        startRequests: _startRequests,
        stopRequests: _stopRequests,
    }
})()

export function startQueue() {
    startRequests()
}
export function stopQueue() {
    stopRequests()
}
export interface UserRating {
    games: number
    prog: number
    rating: number
    rd: number
}
export const UserRatingDecoder: Decoder<UserRating> = object(
    ['games', number()],
    ['prog', number()],
    ['rating', number()],
    ['rd', number()],
    (games, prog, rating, rd) => ({
        games,
        prog,
        rating,
        rd,
    })
)
export interface UserRatings {
    bullet: UserRating
    blitz: UserRating
    rapid: UserRating
    classical: UserRating
    correspondence: UserRating
}
export const UserRatingsDecoder: Decoder<UserRatings> = object(
    ['bullet', UserRatingDecoder],
    ['blitz', UserRatingDecoder],
    ['rapid', UserRatingDecoder],
    ['classical', UserRatingDecoder],
    ['correspondence', UserRatingDecoder],
    (bullet, blitz, rapid, classical, correspondence) => ({
        bullet,
        blitz,
        rapid,
        classical,
        correspondence,
    })
)

export interface User {
    id: string
    username: string
    createdAt: number
    seenAt: number
    perfs: UserRatings
}
export const UserDecoder: Decoder<User> = object(
    ['id', string()],
    ['username', string()],
    ['createdAt', number()],
    ['seenAt', number()],
    ['perfs', UserRatingsDecoder],
    (id, username, createdAt, seenAt, perfs) => ({
        id,
        username,
        createdAt,
        seenAt,
        perfs,
    })
)

export async function fetchUserByName(
    name: string,
    isBackground: boolean = false
) {
    const response = await makeRequest(
        `https://lichess.org/api/user/${name}`,
        false,
        isBackground,
        'application/json'
    )
    return UserDecoder.decodeJSON(response.body)
}

// -----------------------------------------------------------------------------
// given a gamelinkID, use the lichess api to get the game details
// pass the details to the callback as a JSON object
// -----------------------------------------------------------------------------
export interface ShortUser {
    name: string
    id: string
}
export const ShortUserDecoder: Decoder<ShortUser> = object(
    ['name', string()],
    ['id', string()],
    (name, id) => ({ name, id })
)

export interface Player {
    user: ShortUser
    rating: number
}
export const PlayerDecoder: Decoder<Player> = object(
    ['user', ShortUserDecoder],
    ['rating', number()],
    (user, rating) => ({ user, rating })
)
export const StreamPlayerDecoder: Decoder<Player> = object(
    ['userId', string()],
    ['rating', number()],
    (userId, rating) => ({ user: { id: userId, name: userId }, rating })
)
export interface Players {
    white: Player
    black: Player
}
export const PlayersDecoder: Decoder<Players> = object(
    ['white', oneOf(PlayerDecoder, StreamPlayerDecoder)],
    ['black', oneOf(PlayerDecoder, StreamPlayerDecoder)],
    (white, black) => ({ white, black })
)
export interface Opening {
    eco: string
    name: string
    ply: number
}
export const OpeningDecoder: Decoder<Opening> = object(
    ['eco', string()],
    ['name', string()],
    ['ply', number()],
    (eco, name, ply) => ({ eco, name, ply })
)
export interface Clock {
    initial: number
    increment: number
    // totalTime: number
}
export const ClockDecoder: Decoder<Clock> = object(
    ['initial', number()],
    ['increment', number()],
    // ['totalTime', number()],
    (initial, increment /*, totalTime*/) => ({
        initial,
        increment /* totalTime */,
    })
)
export enum GameStatus {
    created = 10,
    started = 20,
    aborted = 25,
    mate = 30,
    resign = 31,
    stalemate = 32,
    timeout = 33,
    draw = 34,
    outoftime = 35,
    cheat = 36,
    nostart = 37,
    unknownfinish = 38,
    variantend = 60,
}
export const GameStatusIntDecoder: Decoder<GameStatus> = oneOf(
    equal(10),
    equal(20),
    equal(25),
    equal(30),
    equal(31),
    equal(32),
    equal(33),
    equal(34),
    equal(35),
    equal(36),
    equal(37),
    equal(38),
    equal(60)
)
export const GameStatusStringDecoder: Decoder<GameStatus> = oneOf(
    andThen(equal('created'), () => succeed(GameStatus.created)),
    andThen(equal('started'), () => succeed(GameStatus.started)),
    andThen(equal('aborted'), () => succeed(GameStatus.aborted)),
    andThen(equal('mate'), () => succeed(GameStatus.mate)),
    andThen(equal('resign'), () => succeed(GameStatus.resign)),
    andThen(equal('stalemate'), () => succeed(GameStatus.stalemate)),
    andThen(equal('timeout'), () => succeed(GameStatus.timeout)),
    andThen(equal('draw'), () => succeed(GameStatus.draw)),
    andThen(equal('outoftime'), () => succeed(GameStatus.outoftime)),
    andThen(equal('cheat'), () => succeed(GameStatus.cheat)),
    andThen(equal('nostart'), () => succeed(GameStatus.nostart)),
    andThen(equal('unknownfinish'), () => succeed(GameStatus.unknownfinish)),
    andThen(equal('variantend'), () => succeed(GameStatus.variantend))
)
export type GameWinner = 'white' | 'black'
export const GameWinnerDecoder: Decoder<GameWinner> = oneOf(
    equal('white'),
    equal('black')
)
export function gameResult(
    status: GameStatus,
    winner?: GameWinner
): ResultsEnum {
    if (status === GameStatus.draw || status === GameStatus.stalemate) {
        return ResultsEnum.DRAW
    }
    if (!isDefined(winner)) {
        return ResultsEnum.UNKNOWN
    }
    if (status === GameStatus.cheat) {
        if (winner === 'white') {
            return ResultsEnum.WHITE_FORFEIT_WIN
        } else {
            return ResultsEnum.BLACK_FORFEIT_WIN
        }
    }
    if (winner === 'white') {
        return ResultsEnum.WHITE_WIN
    } else if (winner === 'black') {
        return ResultsEnum.BLACK_WIN
    }
    return ResultsEnum.UNKNOWN
}
export interface GameDetails {
    id: string
    rated: boolean
    variant: string
    speed: string
    perf: string
    createdAt: number
    players: Players
    status: GameStatus
    winner?: GameWinner
    result: ResultsEnum
    game_link: string
    // opening: Opening
    // moves: string
    clock?: Clock
}
export const BaseGameDetailsDecoder: Decoder<GameDetails> = object(
    ['id', string()],
    ['rated', boolean()],
    ['variant', string()],
    ['speed', string()],
    ['perf', string()],
    ['createdAt', number()],
    // ['lastMoveAt', number()],
    ['players', PlayersDecoder],
    ['status', oneOf(GameStatusStringDecoder, GameStatusIntDecoder)],
    (
        id,
        rated,
        variant,
        speed,
        perf,
        createdAt,
        // lastMoveAt,
        players,
        status
    ) => ({
        id,
        rated,
        variant,
        speed,
        perf,
        createdAt,
        // lastMoveAt,
        players,
        status,
        game_link: `https://lichess.org/${id}`,
        result: gameResult(status),
    })
)
// Awful way of dealing with optional properties. Silly library
export const GameDetailsWithClockDecoder: Decoder<GameDetails> = andThen(
    BaseGameDetailsDecoder,
    (gameDetails) =>
        object(['clock', ClockDecoder], (clock) => ({ ...gameDetails, clock }))
)
export const GameDetailsWithWinnerDecoder: Decoder<GameDetails> = andThen(
    BaseGameDetailsDecoder,
    (gameDetails) =>
        object(['winner', GameWinnerDecoder], (winner) => ({
            ...gameDetails,
            winner,
            result: gameResult(gameDetails.status, winner),
        }))
)
export const GameDetailsWithClockWithWinnerDecoder: Decoder<GameDetails> =
    andThen(BaseGameDetailsDecoder, (gameDetails) =>
        object(
            ['clock', ClockDecoder],
            ['winner', GameWinnerDecoder],
            (clock, winner) => ({
                ...gameDetails,
                clock,
                winner,
                result: gameResult(gameDetails.status, winner),
            })
        )
    )
export const GameDetailsDecoder: Decoder<GameDetails> = oneOf(
    GameDetailsWithClockWithWinnerDecoder,
    GameDetailsWithClockDecoder,
    GameDetailsWithWinnerDecoder,
    BaseGameDetailsDecoder
)

export async function fetchGameDetails(gamelinkID: string) {
    const url = `https://lichess.org/game/export/${gamelinkID.substr(0, 8)}`
    const response = await makeRequest(url, false, false, 'application/json')
    return GameDetailsDecoder.decodeJSON(response.body)
}

// -----------------------------------------------------------------------------
// Get a player rating, but only ping lichess once every 30 minutes for each
// player.  It's supposed to be a classical rating, so it probably won't update
// that often in a 30 minutes period. Besides, this function is not intended
// for people to show off their latest rating.  If they wan to do that they
// can type it in themselves.
// -----------------------------------------------------------------------------
// -------------------------------------------------------------------------
async function _updateRating(
    name: string,
    isBackground: boolean
): Promise<number> {
    // store the promise for reuse
    try {
        const user: User = await fetchUserByName(name, isBackground)
        const rating = user.perfs.classical.rating
        // Get the writable lock for the database.
        const lichessRatings = await db.LichessRating.findOrCreate({
            where: { lichessUserName: name },
        })
        const lichessRating = lichessRatings[0]
        lichessRating.set('rating', rating)
        lichessRating.set('lastCheckedAt', moment.utc().toDate())
        lichessRating.save().then(() => {
            winston.info(`Got updated rating for ${name}: ${rating}`)
        })
        return rating
    } catch (error) {
        winston.error('Error getting player by name: ' + error)
        throw error
    }
}

// -------------------------------------------------------------------------
// Get the player rating. Always return the most recent rating from the
// database, unless they don't have it. Then go get it and return it.
// -------------------------------------------------------------------------
export async function getPlayerRating(
    name: string,
    isBackground: boolean = false
): Promise<number> {
    name = name.toLowerCase()

    try {
        // Ensure we have a record.
        const lichessRatingRec = await db.LichessRating.findOrCreate({
            where: { lichessUserName: name },
        })
        const lichessRating = lichessRatingRec[0]

        const _30MinsAgo = moment.utc().subtract(30, 'minutes')
        let lastCheckedAt = moment(lichessRating.get('lastCheckedAt'))
        if (lastCheckedAt) {
            lastCheckedAt = moment.utc(lastCheckedAt)
        }

        // if a promise exists, then the player is already queued
        const rating = lichessRating.get('rating')

        // Only update the rating if it's older than 30 minutes
        // or if we don't have one a rating
        if (
            _.isNil(rating) ||
            !lastCheckedAt ||
            lastCheckedAt.isBefore(_30MinsAgo)
        ) {
            // If we don't have it or it's out of date
            return await _updateRating(name, isBackground)
        }

        return lichessRating.get('rating')
    } catch (error) {
        winston.error(`Error querying for rating: ${error}`)
        throw error
    }
}
