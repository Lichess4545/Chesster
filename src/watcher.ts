// -----------------------------------------------------------------------------
// Watcher uses the game-stream API from Lichess to listen for games as they
// start and end.
// -----------------------------------------------------------------------------

import _ from 'lodash'
import fp from 'lodash/fp'
import { ClientRequest } from 'http'
import _https from 'https'
import url from 'url'
import moment from 'moment-timezone'

// local imports
import * as games from './commands/games'
import * as heltour from './heltour'
import * as lichess from './lichess'
import * as config from './config'
import { League, Pairing, ResultsEnum } from './league'
import { LogWithPrefix } from './logging'
import { SlackBot } from './slack'
import { isDefined } from './utils'

const WATCHER_MAX_USERNAMES = 900
const STARTED = 20

type ConnectionState =
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'backing_off'

class WatcherRequest {
    req: undefined | ClientRequest = undefined
    private log: LogWithPrefix
    private fullyQuit = false

    private state: ConnectionState = 'disconnected'
    private connectedAt: number | undefined
    private lastDataAt: number | undefined

    private backoffSeconds = 1
    private reconnectTimer: ReturnType<typeof setTimeout> | undefined
    private inactivityTimer: ReturnType<typeof setTimeout> | undefined
    private healthTimer: ReturnType<typeof setInterval> | undefined

    private lineBuffer = ''

    private watcherConfig: config.WatcherConfig

    constructor(
        public bot: SlackBot,
        public usernames: string[],
        public leagues: League[],
        public id: number
    ) {
        this.log = new LogWithPrefix(`WatcherRequest: ${this.id}`)
        this.watcherConfig = bot.config.watcher
    }

    get isDown(): boolean {
        return this.state === 'backing_off' || this.state === 'disconnected'
    }

    private setState(newState: ConnectionState) {
        if (this.state !== newState) {
            this.log.info(`State: ${this.state} -> ${newState}`)
            this.state = newState
        }
    }

    private resetInactivityTimer() {
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer)
        }
        const timeoutMs =
            this.watcherConfig.inactivityTimeoutMinutes * 60 * 1000
        this.inactivityTimer = setTimeout(() => {
            this.log.warn(
                `No data received for ${this.watcherConfig.inactivityTimeoutMinutes} minutes, reconnecting`
            )
            this.destroyAndReconnect()
        }, timeoutMs)
    }

    private startHealthLogging() {
        this.stopHealthLogging()
        const intervalMs =
            this.watcherConfig.healthLogIntervalMinutes * 60 * 1000
        this.healthTimer = setInterval(() => {
            const now = Date.now()
            const uptimeSeconds = this.connectedAt
                ? Math.round((now - this.connectedAt) / 1000)
                : 0
            const lastDataSeconds = this.lastDataAt
                ? Math.round((now - this.lastDataAt) / 1000)
                : -1
            this.log.info(
                `Health: state=${this.state} uptime=${uptimeSeconds}s lastData=${lastDataSeconds}s users=${this.usernames.length}`
            )
        }, intervalMs)
    }

    private stopHealthLogging() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer)
            this.healthTimer = undefined
        }
    }

    private scheduleReconnect() {
        if (this.fullyQuit) {
            this.setState('disconnected')
            return
        }
        this.setState('backing_off')
        this.log.info(`Reconnecting in ${this.backoffSeconds}s`)
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = undefined
            this.watch()
        }, this.backoffSeconds * 1000)
        this.backoffSeconds = Math.min(
            this.backoffSeconds * 2,
            this.watcherConfig.maxBackoffSeconds
        )
    }

    private destroyAndReconnect() {
        if (this.req) {
            this.req.destroy()
            this.req = undefined
        }
        this.scheduleReconnect()
    }

    watch() {
        this.stop()
        this.setState('connecting')
        this.lineBuffer = ''

        const body = this.usernames.join(',')
        this.log.info(
            `[CONNECT] Starting stream to ${this.bot.config.watcherBaseURL} for ${this.usernames.length} users`
        )
        const options = url.parse(this.bot.config.watcherBaseURL)
        let hasResponse = false
        this.req = _https.request({
            method: 'POST',
            headers: {
                'Content-Length': Buffer.byteLength(body),
                Authorization: `Bearer ${this.bot.config.watcherToken}`,
            },
            ...options,
        })
        this.req
            .on('response', (res) => {
                hasResponse = true

                if (res.statusCode !== 200) {
                    let errorBody = ''
                    res.on('data', (chunk) => {
                        errorBody += chunk.toString()
                    })
                    res.on('end', () => {
                        this.log.error(
                            `HTTP ${res.statusCode}: ${errorBody.slice(0, 500)}`
                        )
                        this.req = undefined
                        if (res.statusCode === 429) {
                            this.backoffSeconds = Math.max(
                                this.backoffSeconds,
                                60
                            )
                        }
                        this.scheduleReconnect()
                    })
                    return
                }

                this.setState('connected')
                this.connectedAt = Date.now()
                this.resetInactivityTimer()
                this.startHealthLogging()

                res.on('data', (chunk) => {
                    this.lastDataAt = Date.now()
                    this.resetInactivityTimer()

                    this.lineBuffer += chunk.toString()
                    const lines = this.lineBuffer.split('\n')
                    this.lineBuffer = lines.pop()!

                    for (const line of lines) {
                        const trimmed = line.trim()
                        if (trimmed === '') {
                            this.log.debug('Received ping')
                            this.backoffSeconds = 1
                            continue
                        }
                        this.backoffSeconds = 1
                        this.log.debug(`Received data: [${trimmed}]`)
                        try {
                            const details =
                                lichess.GameDetailsDecoder.decodeJSON(trimmed)
                            this.log.info(
                                `Received game details: ${JSON.stringify(details)}`
                            )
                            Promise.all(
                                this.leagues.map((l) =>
                                    l.refreshCurrentRoundSchedules()
                                )
                            ).then(
                                () => {
                                    this.processGameDetails(details)
                                },
                                (error) => {
                                    this.log.error(
                                        `Error refreshing pairings: ${JSON.stringify(
                                            error
                                        )}`
                                    )
                                }
                            )
                        } catch (e) {
                            this.log.error(
                                `JSON parse error (continuing): ${e instanceof Error ? e.message : JSON.stringify(e)}`
                            )
                        }
                    }
                })
                res.on('end', () => {
                    this.log.info('Response stream ended')
                    this.req = undefined
                    this.stopHealthLogging()
                    if (this.inactivityTimer) {
                        clearTimeout(this.inactivityTimer)
                        this.inactivityTimer = undefined
                    }
                    if (!this.fullyQuit) {
                        this.scheduleReconnect()
                    } else {
                        this.setState('disconnected')
                        this.log.info(
                            "Not restarting as I've been asked to go down"
                        )
                    }
                })
            })
            .on('error', (e) => {
                this.log.error(
                    `[CONNECT] Request error (hasResponse=${hasResponse}): ${e instanceof Error ? e.message : JSON.stringify(e)}`
                )
                if (!hasResponse) {
                    this.req = undefined
                    if (!this.fullyQuit) {
                        this.scheduleReconnect()
                    } else {
                        this.setState('disconnected')
                    }
                }
            })
        this.req.setSocketKeepAlive(true, 0)
        this.req.write(body)
        this.req.end()
    }

    stop() {
        if (this.req) {
            this.req.destroy()
            this.req = undefined
        }
    }

    quit() {
        this.log.info('Asked to quit, going down')
        this.fullyQuit = true
        this.stop()
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer)
            this.reconnectTimer = undefined
        }
        if (this.inactivityTimer) {
            clearTimeout(this.inactivityTimer)
            this.inactivityTimer = undefined
        }
        this.stopHealthLogging()
        this.setState('disconnected')
    }

    // -------------------------------------------------------------------------
    async processGameDetails(details: lichess.GameDetails) {
        this.log.info(
            `[PROCESS] Processing game ${details.id}: ${details.players.white.user} vs ${details.players.black.user}`
        )
        fp.each(async (league) => {
            // 1. perfect match any time, try to update.
            // 2. pairing + time control match any time, warn for other mismatches
            // 3. pairing match during a 4 hour window (+-2 hours), warn for other mismatches
            if (
                !isDefined(league.config.gamelinks) ||
                !isDefined(league.config.results)
            ) {
                this.log.debug(
                    `[PROCESS] ${league.name}: Skipping - no gamelinks/results config`
                )
                return
            }
            const gamelinks: config.GameLinks = league.config.gamelinks
            const results: config.Results = league.config.results

            const result = games.validateGameDetails(league, details)
            this.log.info(
                `[PROCESS] ${league.name}: valid=${result.valid}, reason=${result.reason || 'none'}`
            )
            // If we don't have a pairing from this information, then it will
            // never be valid. Ignore it.
            if (!result.pairing) {
                this.log.debug(
                    `[PROCESS] ${league.name}: No matching pairing, ignoring`
                )
                return
            }
            const white = result.pairing.white.toLowerCase()
            const black = result.pairing.black.toLowerCase()

            let scheduledDate: moment.Moment | undefined = moment.utc(
                result.pairing.scheduledDate
            )
            const now = moment.utc()
            if (!scheduledDate.isValid()) {
                scheduledDate = undefined
            }

            if (result.valid) {
                if (result.pairing.result !== ResultsEnum.UNKNOWN) {
                    this.log.info(
                        `[PROCESS] ${league.name}: Game ${details.id} valid but result already exists`
                    )
                    if (details.status === STARTED) {
                        this.bot.say({
                            text:
                                `<@${white}>,  <@${black}>:` +
                                ' There is already a result set for this pairing. If you want ' +
                                'the new game to count for the league, please contact a mod.',
                            channel: gamelinks?.channelId,
                        })
                    }
                } else if (
                    result.pairing.url &&
                    !result.pairing.url.endsWith(details.id)
                ) {
                    this.log.info(
                        `[PROCESS] ${league.name}: Game ${details.id} valid but gamelink mismatch (existing: ${result.pairing.url})`
                    )
                    if (details.status === STARTED) {
                        this.bot.say({
                            text:
                                `<@${white}>,  <@${black}>:` +
                                ' There is already a gamelink set for this pairing. If you want ' +
                                'the new game to count for the league, please contact a mod.',
                            channel: gamelinks.channelId,
                        })
                    }
                } else {
                    this.log.info(
                        `[PROCESS] ${league.name}: Game ${details.id} valid and needed`
                    )
                    // Fetch the game details from the lichess games API because updateGamelink is more picky about the details format
                    // This could be obviated by an enhancement to the game-stream API
                    try {
                        const detailsFromApi = await lichess.fetchGameDetails(
                            details.id
                        )
                        try {
                            const updatePairingResult =
                                await games.updateGamelink(
                                    league,
                                    detailsFromApi
                                )
                            if (updatePairingResult.gameLinkChanged) {
                                this.bot.say({
                                    text:
                                        '<@' +
                                        white +
                                        '> vs <@' +
                                        black +
                                        '>: <' +
                                        detailsFromApi.game_link +
                                        '>',
                                    channel: gamelinks.channelId,
                                    attachments: [], // Needed to activate link parsing in the message
                                })
                            } else if (updatePairingResult.resultChanged) {
                                this.bot.say({
                                    text: `<@${white}> ${detailsFromApi.result} <@${black}>`,
                                    channel: results.channelId,
                                })
                            }
                        } catch (error) {
                            this.log.error(
                                `Error updating game: ${JSON.stringify(error)}`
                            )
                        }
                    } catch (error) {
                        this.log.error(
                            `Error fetching game details: ${JSON.stringify(
                                error
                            )}`
                        )
                    }
                }
            } else if (
                details.status === STARTED ||
                result.claimVictoryNotAllowed ||
                result.cheatDetected
            ) {
                this.log.info(
                    `[PROCESS] ${league.name}: Game ${details.id} invalid - ${result.reason}`
                )

                const hours = Math.abs(now.diff(scheduledDate, 'hours'))
                if (
                    (!scheduledDate || hours >= 2) &&
                    result.timeControlIsIncorrect
                ) {
                    // If the game is not the right time control,
                    // and we are not within 2 hours either way
                    // of the scheduled time, then don't warn.
                    return
                }

                this.log.info('Sending warning')
                this.bot.say({
                    text:
                        '<@' +
                        white +
                        '>,  <@' +
                        black +
                        '>:' +
                        ' Your game is *not valid* because ' +
                        '*' +
                        result.reason +
                        '*',
                    channel: gamelinks.channelId,
                })
                this.bot.say({
                    text:
                        'If this was a mistake, please correct it and ' +
                        'try again. If this is not a league game, you ' +
                        'may ignore this message. Thank you.',
                    channel: gamelinks.channelId,
                })
                heltour
                    .sendGameWarning(
                        league.config.heltour,
                        white,
                        black,
                        result.reason
                    )
                    .catch((error) => {
                        this.log.error(
                            `Error sending game warning: ${JSON.stringify(
                                error
                            )}`
                        )
                    })
            }
        }, this.leagues)
    }
}

type RefreshInfo = {
    length: number
    name: string
}

export default class Watcher {
    watcherRequests: WatcherRequest[]
    usernames: string[] = []
    private refreshesCount = 0
    private leaguesRefreshed: RefreshInfo[] = []

    private log: LogWithPrefix = new LogWithPrefix('Watcher')

    constructor(
        public bot: SlackBot,
        public leagues: League[]
    ) {
        this.watcherRequests = []
        this.log.info('Starting watcher')

        // Whenever any of the leagues refresh, potentially restart watcher requests
        this.leagues.map((l) =>
            l.onRefreshPairings(() => {
                this.leaguesRefreshed.push({
                    length: l._pairings.length,
                    name: l.name,
                })
                this.refreshesCount++
                if (this.refreshesCount % this.leagues.length === 0) {
                    const leagueNames = this.leaguesRefreshed
                        .map((i) => i.name)
                        .join(', ')
                    const totalPairings = this.leaguesRefreshed.reduce(
                        (total, current) => total + current.length,
                        0
                    )
                    this.log.info(
                        `Refreshed leagues ${leagueNames} with ${totalPairings} pairings`
                    )
                    this.leaguesRefreshed = []
                    // Only restart when we refresh the last league
                    this.watch()
                }
            })
        )
    }

    clear() {
        this.log.debug('Clearing the watcher requests')
        this.watcherRequests.map((r) => r.quit())
        this.watcherRequests = []
    }

    watch() {
        const newUsernames = _.uniq(
            fp
                .flatMap((l) => l._pairings, this.leagues)
                .flatMap((p: Pairing) => [p.white, p.black])
                .map((u) => u.toLowerCase())
                .sort()
        )
        const forceRestart = this.watcherRequests.some((r) => r.isDown)
        if (!_.isEqual(newUsernames, this.usernames) || forceRestart) {
            if (forceRestart) {
                this.log.info('Restart forced due to down watcher request.')
            }
            this.clear()
            this.usernames = newUsernames
            let i = 0
            while (i < this.usernames.length) {
                const watcherUsernames = _.slice(
                    this.usernames,
                    i,
                    i + WATCHER_MAX_USERNAMES
                )
                const req = new WatcherRequest(
                    this.bot,
                    watcherUsernames,
                    this.leagues,
                    Math.floor(this.refreshesCount / this.leagues.length)
                )
                req.watch()
                this.watcherRequests.push(req)
                i += WATCHER_MAX_USERNAMES
            }
            this.log.info(
                `Watching ${this.usernames.length} names with ${this.watcherRequests.length} requests`
            )
        } else {
            // Visibility of potential exceptions
            this.log.debug(
                '[WATCHER] No restart needed - usernames unchanged and no forceRestart'
            )
        }
    }
}
