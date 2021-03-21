// -----------------------------------------------------------------------------
// Watcher uses the game-stream API from Lichess to listen for games as they
// start and end.
// -----------------------------------------------------------------------------

// Previous imports
import _ from 'lodash'
import fp from 'lodash/fp'
import { ClientRequest } from 'http'
import _https from 'https'
import url from 'url'
import moment from 'moment-timezone'
import Q from 'q'

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

// TODO: stop using these
const BACKOFF_TIMEOUT = 10
// const CREATED = 10;
const STARTED = 20
// const ABORTED = 25;
// const MATE = 30;
// const RESIGN = 31;
// const STALEMATE = 32;
// const TIMEOUT = 33;
// const DRAW = 34;
// const OUT_OF_TIME = 35;
// const CHEAT = 36;
// const NO_START = 37;
// const UNKNOWN_FINISH = 38;
// const VARIANT_END = 60;

class WatcherRequest {
    req: undefined | ClientRequest = undefined
    private started?: moment.Moment
    private log: LogWithPrefix = new LogWithPrefix('WatcherRequest')
    private fullyQuit = false

    constructor(
        public bot: SlackBot,
        public usernames: string[],
        public leagues: League[],
        public id: number
    ) {
        this.log = new LogWithPrefix(`WatcherRequest: ${this.id}`)
    }

    watch() {
        if (this.stop()) {
            return // The .on('end') handler will restart us.
        }

        // Guard against hammering lichess when it's down and feeding us errors.
        // In this case, if we get two errors in 10s, we'll wait till the next
        // refressh which will eventually wait 2 minutes between requests.
        const lastStarted = this.started
        this.started = moment.utc()
        if (
            lastStarted &&
            this.started.unix() - lastStarted.unix() < BACKOFF_TIMEOUT
        ) {
            this.log.warn(
                `Backing off the watcher due to two starts in 10s: ${
                    this.started.unix() - lastStarted.unix()
                }s`
            )
            this.usernames = []
            return
        }
        const body = this.usernames.join(',')
        this.log.debug(
            `Watching ${this.bot.config.watcherBaseURL} with ${body} users`
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
                this.log.debug('Connected')
                res.on('data', (chunk) => {
                    const incoming = chunk.toString().trim()
                    this.log.debug(`Received data: [${incoming}]`)
                    try {
                        if (incoming === '') {
                            this.log.info('Received empty ping. :)')
                            return
                        }
                        const details = lichess.GameDetailsDecoder.decodeJSON(
                            incoming
                        )
                        this.log.info(
                            `Received game details: ${JSON.stringify(details)}`
                        )
                        Q.all(
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
                        this.log.error(JSON.stringify(e))
                        this.log.error('Ending request due to error in content')
                        if (this.req) {
                            this.req.abort()
                        }
                        this.req = undefined
                    }
                })
                res.on('end', () => {
                    this.log.info('WatcherRequest response ended')
                    this.req = undefined
                    if (!this.fullyQuit) {
                        this.log.info(`Restarting watcher`)
                        this.watch()
                    } else {
                        this.log.info(
                            `Not restarting as I've been asked to go down`
                        )
                    }
                })
                hasResponse = true
            })
            .on('error', (e) => {
                this.log.error(JSON.stringify(e))
                // If we have a response, the above res.on('end') gets called even in this case.
                // So let the above restart the watcher
                if (!hasResponse) {
                    this.req = undefined
                    if (!this.fullyQuit) {
                        this.log.info(`Restarting watcher`)
                        this.watch()
                    } else {
                        this.log.info(
                            `Not restarting as I've been asked to go down`
                        )
                    }
                }
            })
        // Setting 0 for initialDelay (2nd param) will leave the value
        // unchanged from the default (or previous) setting.
        this.req.setSocketKeepAlive(true, 0)
        this.req.write(body)
        this.req.end()
    }

    stop(): boolean {
        // Ensure we close/abort any previous request before starting a new one.
        if (this.req) {
            this.req.abort()
            this.req = undefined
            return true
        }
        return false
    }

    quit(): void {
        this.log.info('Asked to quit, going down')
        this.fullyQuit = true
        this.stop()
    }

    // -------------------------------------------------------------------------
    async processGameDetails(details: lichess.GameDetails) {
        fp.each(async (league) => {
            // 1. perfect match any time, try to update.
            // 2. pairing + time control match any time, warn for other mismatches
            // 3. pairing match during a 4 hour window (+-2 hours), warn for other mismatches
            if (
                !isDefined(league.config.gamelinks) ||
                !isDefined(league.config.results)
            ) {
                return
            }
            const gamelinks: config.GameLinks = league.config.gamelinks
            const results: config.Results = league.config.results

            const result = games.validateGameDetails(league, details)
            this.log.info(`Validation result: ${JSON.stringify(result)}`)
            // If we don't have a pairing from this information, then it will
            // never be valid. Ignore it.
            if (!result.pairing) {
                this.log.info(`No pairing so ignoring!`)
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
                        `Received VALID game but result already exists`
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
                        `Received VALID game but game link does not match`
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
                    this.log.info('Received VALID AND NEEDED game!')
                    // Fetch the game details from the lichess games API because updateGamelink is more picky about the details format
                    // This could be obviated by an enhancement to the game-stream API
                    try {
                        const detailsFromApi = await lichess.fetchGameDetails(
                            details.id
                        )
                        try {
                            const updatePairingResult = await games.updateGamelink(
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
                this.log.info('Received INVALID game')

                const hours = Math.abs(now.diff(scheduledDate))
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

    constructor(public bot: SlackBot, public leagues: League[]) {
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
                    const leagues = this.leaguesRefreshed
                        .map((i) => i.name)
                        .join(', ')
                    const totalPairings = this.leaguesRefreshed.reduce(
                        (total, current) => total + current.length,
                        0
                    )
                    this.log.info(
                        `Refreshed leagues ${leagues} with ${totalPairings} pairings`
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
        if (!_.isEqual(newUsernames, this.usernames)) {
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
        }
    }
}
