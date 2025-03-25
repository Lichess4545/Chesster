// -----------------------------------------------------------------------------
// Defines a league object which can be used to interact with the website
// for the given league
// -----------------------------------------------------------------------------
import _ from 'lodash'
import winston from 'winston'
import moment from 'moment-timezone'
import * as heltour from './heltour'
import * as lichess from './lichess'
import { League as LeagueConfig } from './config'
import { EventEmitter } from 'events'
import { SlackBot, LeagueMember, localTime } from './slack'
import { LogWithPrefix } from './logging'
import { isDefined } from './utils'

// An emitter for league events
class ChessLeagueEmitter extends EventEmitter {}

export interface Player {
    username: string
    rating: number
    team: Team
    isCaptain: boolean
    boardNumber?: number
}
export enum ResultsEnum {
    UNKNOWN = '',
    WHITE_WIN = '1-0',
    BLACK_WIN = '0-1',
    DRAW = '1/2-1/2',
    SCHEDULING_DRAW = '1/2Z-1/2Z',
    BLACK_FORFEIT_WIN = '0F-1X',
    WHITE_FORFEIT_WIN = '1/2-1/2',
}
export interface Pairing {
    white: string
    // TODO: should this be optional?
    white_team?: string
    black: string
    // TODO: should this be optional?
    black_team?: string
    scheduledDate?: moment.Moment
    url?: string
    result: ResultsEnum
}
export interface PairingDetails extends Pairing {
    color: 'white' | 'black'
    player: string
    opponent: string
    rating?: number
    league: League
}
export function isPairingDetails(
    pd: PairingDetails | undefined
): pd is PairingDetails {
    return pd !== undefined
}

export interface LeagueLinks {
    rules: string
    faq: string
    league: string
    lonewolf: string
    guide: string
    captains: string
    registration: string
    source: string
    pairings: string
    standings: string
    nominate: string
    notifications: string
    availability: string
}
export interface Team {
    name: string
    players: Player[]
    captain?: Player
    number: number
    slack_channel: string
}
type RefreshRostersCallback = () => void
type RefreshPairingsCallback = () => void

function resultFromString(result: string | undefined): ResultsEnum {
    if (result === undefined) return ResultsEnum.UNKNOWN
    result = result.toLowerCase()
    if (result === '1-0') {
        return ResultsEnum.WHITE_WIN
    } else if (result === '0-1') {
        return ResultsEnum.BLACK_WIN
    } else if (result === '1/2-1/2') {
        return ResultsEnum.DRAW
    } else if (result === '1/2z-1/2z') {
        return ResultsEnum.SCHEDULING_DRAW
    } else if (result === '0F-1X') {
        return ResultsEnum.BLACK_FORFEIT_WIN
    } else if (result === '1X-0F') {
        return ResultsEnum.WHITE_FORFEIT_WIN
    } else {
        return ResultsEnum.UNKNOWN
    }
}

export class League {
    private log: LogWithPrefix

    constructor(
        public bot: SlackBot,
        public name: string,
        public config: LeagueConfig,
        public _players: Player[] = [],
        public _pairings: Pairing[] = [],
        public _teams: Team[] = []
    ) {
        this.emitter = new ChessLeagueEmitter()
        this.log = new LogWithPrefix(`[League(${this.name})]`)
    }

    // -------------------------------------------------------------------------
    // A lookup from player username to a player object (from _players)
    // -------------------------------------------------------------------------
    _playerLookup: Record<string, Player> = {}

    // -------------------------------------------------------------------------
    // A lookup from a team name to the team object.
    // -------------------------------------------------------------------------
    _teamLookup: Record<string, Team> = {}

    // -------------------------------------------------------------------------
    // A list of moderator names
    // -------------------------------------------------------------------------
    _moderators: string[] = []

    // -------------------------------------------------------------------------
    // The datetime when we were last updated
    // -------------------------------------------------------------------------
    _lastUpdated: moment.Moment = moment.utc()
    emitter: ChessLeagueEmitter

    // -------------------------------------------------------------------------
    // Canonicalize the username
    // -------------------------------------------------------------------------
    canonicalUsername(username: string): string {
        username = username.split(' ')[0]
        return username.replace('*', '')
    }

    // -------------------------------------------------------------------------
    // Lookup a player by playerName
    // -------------------------------------------------------------------------
    getPlayer(username: string): Player | undefined {
        return this._playerLookup[_.toLower(username)]
    }

    // -------------------------------------------------------------------------
    // Register a refreshRosters event
    // -------------------------------------------------------------------------
    onRefreshRosters(fn: RefreshRostersCallback) {
        this.emitter.on('refreshRosters', fn)
    }

    // -------------------------------------------------------------------------
    // Register a refreshPairings event
    // -------------------------------------------------------------------------
    onRefreshPairings(fn: RefreshPairingsCallback) {
        this.emitter.on('refreshPairings', fn)
    }

    // -------------------------------------------------------------------------
    // Refreshes everything
    // -------------------------------------------------------------------------
    refresh() {
        return Promise.all([
            this.refreshRosters()
                .then(() => {
                    this._lastUpdated = moment.utc()
                    this.emitter.emit('refreshRosters', this)
                })
                .catch((error) => {
                    winston.error(
                        `${this.name}: Unable to refresh rosters: ${error}`
                    )
                    throw error
                }),
            this.refreshCurrentRoundSchedules()
                .then(() => {
                    this._lastUpdated = moment.utc()
                    this.emitter.emit('refreshPairings', this)
                })
                .catch((error) => {
                    if (error !== 'no_matching_rounds') {
                        winston.error(
                            `${this.name}: Unable to refresh pairings: ${error}`
                        )
                    }
                    throw error
                }),
            this.refreshLeagueModerators()
                .then(() => {
                    this._lastUpdated = moment.utc()
                })
                .catch((error) => {
                    winston.error(
                        `${this.name}: Unable to refresh moderators: ${error}`
                    )
                    throw error
                }),
        ])
    }

    // -------------------------------------------------------------------------
    // Refreshes the latest roster information
    // -------------------------------------------------------------------------
    async refreshRosters() {
        const newPlayers: Player[] = []
        const newPlayerLookup: Record<string, Player> = {}
        const newTeams: Team[] = []
        const newTeamLookup: Record<string, Team> = {}

        const roster = await heltour.getRoster(
            this.config.heltour,
            this.config.heltour.leagueTag
        )
        const incomingPlayerLookup: Record<string, heltour.Player> = {}
        roster.players.map((p) => {
            incomingPlayerLookup[p.username.toLowerCase()] = p
        })
        if (heltour.isTeamLeagueRoster(roster)) {
            roster.teams.map((team) => {
                const newTeam: Team = {
                    name: team.name,
                    players: [],
                    number: team.num,
                    slack_channel: team.slackChannel,
                }
                team.players.forEach(({ username, isCaptain, boardNumber }) => {
                    const key = username.toLowerCase()
                    const { rating } = incomingPlayerLookup[key]
                    const newPlayer = {
                        username,
                        team: newTeam,
                        isCaptain,
                        boardNumber,
                        rating,
                    }
                    if (newPlayer.isCaptain) {
                        newTeam.captain = newPlayer
                    }
                    newTeam.players.push(newPlayer)
                    newPlayerLookup[key] = newPlayer
                    newPlayers.push(newPlayer)
                })
                newTeamLookup[newTeam.name.toLowerCase()] = newTeam
                newTeams.push(newTeam)
            })
        }

        this.log.info('Setting new teams and players')
        this._teams = newTeams
        this._teamLookup = newTeamLookup
        this._players = newPlayers
        this._playerLookup = newPlayerLookup
    }

    // -------------------------------------------------------------------------
    // Calls into the website moderators endpoint to get the list of moderators
    // for the league.
    // -------------------------------------------------------------------------
    async refreshLeagueModerators() {
        const moderators = await heltour.getLeagueModerators(
            this.config.heltour
        )
        this._moderators = moderators.map((m) => m.toLowerCase())
    }

    // -------------------------------------------------------------------------
    // Figures out the current scheduling information for the round.
    // -------------------------------------------------------------------------
    async refreshCurrentRoundSchedules() {
        return heltour
            .getAllPairings(this.config.heltour, this.config.heltour.leagueTag)
            .then((pairings: heltour.Pairing[]) => {
                const newPairings: Pairing[] = []
                _.each(pairings, (heltourPairing) => {
                    const date = moment.utc(heltourPairing.datetime)
                    const newPairing: Pairing = {
                        white: heltourPairing.white,
                        black: heltourPairing.black,
                        scheduledDate: date.isValid() ? date : undefined,
                        url: heltourPairing.gameLink,
                        result: resultFromString(heltourPairing.result),
                    }
                    if (heltour.isTeamPairing(heltourPairing)) {
                        newPairing.white_team = heltourPairing.whiteTeam
                        newPairing.black_team = heltourPairing.blackTeam
                    }
                    newPairings.push(newPairing)
                })
                this._pairings = newPairings
                return this._pairings
            })
    }

    // -------------------------------------------------------------------------
    // Finds the pairing for this current round given either a black or a white
    // username.
    // -------------------------------------------------------------------------
    findPairing(white: string, black?: string): Pairing[] {
        if (!white) {
            throw new Error('findPairing requires at least one username.')
        }
        let possibilities = this._pairings
        const filter = (playerName: string) => {
            if (playerName) {
                possibilities = _.filter(possibilities, (item) => {
                    return (
                        item.white.toLowerCase().includes(playerName) ||
                        item.black.toLowerCase().includes(playerName)
                    )
                })
            }
        }
        filter(white)
        if (black) filter(black)
        return possibilities
    }

    // -------------------------------------------------------------------------
    // Returns whether someone is a moderator or not.
    // -------------------------------------------------------------------------
    isModerator(name: string) {
        return _.includes(this._moderators, _.toLower(name))
    }

    // -------------------------------------------------------------------------
    // Prepare a debug message for this league
    // -------------------------------------------------------------------------
    formatDebugResponse(): string {
        const name = this.name
        const pairingsCount = this._pairings.length
        const lastUpdated = this._lastUpdated.format('YYYY-MM-DD HH:mm UTC')
        const since = this._lastUpdated.fromNow(true)
        return `DEBUG:\nLeague: ${name}\nTotal Pairings: ${pairingsCount}\nLast Updated: ${lastUpdated} [${since} ago]`
    }

    // -------------------------------------------------------------------------
    // Generates the appropriate data format for pairing result for this league.
    // -------------------------------------------------------------------------
    async getPairingDetails(
        lichessUsername: string
    ): Promise<PairingDetails | undefined> {
        return new Promise(async (resolve) => {
            const pairings = this.findPairing(lichessUsername)
            if (pairings.length < 1) {
                return resolve(undefined)
            }
            // TODO: determine what to do if multiple pairings are returned. ?
            const pairing = pairings[0]
            const details: PairingDetails = {
                ...pairing,
                player: lichessUsername,
                color: 'white',
                opponent: pairing.black,
                league: this,
            }
            if (
                !_.isEqual(
                    pairing.white.toLowerCase(),
                    lichessUsername.toLowerCase()
                )
            ) {
                details.color = 'black'
                details.opponent = pairing.white
            }
            try {
                const rating = await lichess.getPlayerRating(details.opponent)
                details.rating = rating
                resolve(details)
            } catch (error) {
                winston.error(JSON.stringify(error))
            }
            resolve(undefined)
        })
    }

    // -------------------------------------------------------------------------
    // Formats the pairing result for this league
    // -------------------------------------------------------------------------
    formatPairingResponse(
        requestingPlayer: LeagueMember,
        details: PairingDetails
    ) {
        let time
        if (details.scheduledDate) {
            time = localTime(requestingPlayer, details.scheduledDate)
        }
        let schedulePhrase = ''
        let playedPhrase = ''

        if (!time || !time.isValid()) {
            playedPhrase = 'will play'
            schedulePhrase = '. The game is unscheduled.'
        } else if (moment.utc().isAfter(time)) {
            // If the match took place in the past, display the date instead of the day
            playedPhrase = 'played'
            const localDateTimeString = time.format('YYYY-MM-DD [at] HH:mm')
            schedulePhrase = ` on ${localDateTimeString} in your timezone.`
        } else {
            playedPhrase = 'will play'
            const localDateTimeString = time.format('MM/DD _(dddd)_ [at] HH:mm')
            const timeUntil = time.fromNow(true)
            schedulePhrase = ` on ${localDateTimeString} in your timezone, which is in ${timeUntil}.`
        }

        // Otherwise display the time until the match
        const opponentColor = details.color === 'white' ? 'black' : 'white'
        const rating = details.rating ? '(' + details.rating + ')' : ''
        return (
            `[${this.name}]: :${details.color}pieces: _${details.player}_ ${playedPhrase} against ` +
            `:${opponentColor}pieces: _${details.opponent}_ ${rating}${schedulePhrase}`
        )
    }

    // -------------------------------------------------------------------------
    // Formats the captains Guidelines
    // -------------------------------------------------------------------------
    formatCaptainGuidelinesResponse() {
        if (this.config.links && this.config.links.captains) {
            return `Here are the captain's guidelines:\n${this.config.links.captains}`
        } else {
            return `The ${this.name} league does not have captains guidelines.`
        }
    }

    // -------------------------------------------------------------------------
    // Formats the pairings response
    // -------------------------------------------------------------------------
    formatPairingsLinkResponse() {
        if (this.config.links && this.config.links.league) {
            return (
                'The pairings can be found on the website:\n' +
                this.config.links.pairings +
                '\nAlternatively, try [ @chesster pairing [competitor] ]'
            )
        } else {
            return `The ${this.name} league does not have a pairings link.`
        }
    }

    // -------------------------------------------------------------------------
    // Formats the standings response
    // -------------------------------------------------------------------------
    formatStandingsLinkResponse() {
        if (this.config.links && this.config.links.league) {
            return (
                'The standings can be found on the website:\n' +
                this.config.links.standings
            )
        } else {
            return `The ${this.name} league does not have a standings link.`
        }
    }

    // -------------------------------------------------------------------------
    // Formats the rules link response
    // -------------------------------------------------------------------------
    formatRulesLinkResponse() {
        if (this.config.links.rules) {
            return `Here are the rules and regulations:\n${this.config.links.rules}`
        } else {
            return `The ${this.name} league does not have a rules link.`
        }
    }

    // -------------------------------------------------------------------------
    // Formats the starter guide message
    // -------------------------------------------------------------------------
    formatStarterGuideResponse() {
        if (this.config.links.guide) {
            return `Here is everything you need to know:\n${this.config.links.guide}`
        } else {
            return `The ${this.name} league does not have a starter guide.`
        }
    }

    // -------------------------------------------------------------------------
    // Formats the signup response
    // -------------------------------------------------------------------------
    formatRegistrationResponse() {
        if (this.config.links.registration) {
            return `You can sign up here:\n${this.config.links.registration}`
        } else {
            return `The ${this.name} league does not have an active signup form at the moment.`
        }
    }

    // -------------------------------------------------------------------------
    // Get a list of captain names
    // -------------------------------------------------------------------------
    getCaptains() {
        return this._teams.map((t) => t.captain)
    }

    // -------------------------------------------------------------------------
    // Get the list of teams
    // -------------------------------------------------------------------------
    getTeams() {
        return this._teams
    }

    // -------------------------------------------------------------------------
    // Get the team for a given player name
    // -------------------------------------------------------------------------
    getTeamByPlayerName(playerName: string): Team | undefined {
        playerName = playerName.toLowerCase()
        const directTeamMapping =
            this._playerLookup[playerName] &&
            this._playerLookup[playerName].team
        if (directTeamMapping) return directTeamMapping
        // Try to find the team by looking through the pairings for this
        // playername.  This will find alternates.
        const possiblePairings = this.findPairing(playerName)
        if (possiblePairings.length === 1) {
            const pairing = possiblePairings[0]
            if (_.isEqual(pairing.white.toLowerCase(), playerName)) {
                if (isDefined(pairing.white_team)) {
                    return this.getTeam(pairing.white_team)
                }
            } else if (_.isEqual(pairing.black.toLowerCase(), playerName)) {
                if (isDefined(pairing.black_team)) {
                    return this.getTeam(pairing.black_team)
                }
            }
        }
        return undefined
    }

    // -------------------------------------------------------------------------
    // Get the team for a given team name
    // -------------------------------------------------------------------------
    getTeam(teamName: string): Team | undefined {
        return this._teamLookup[teamName.toLowerCase()]
    }

    // -------------------------------------------------------------------------
    // Get the the players from a particular board
    // -------------------------------------------------------------------------
    getBoard(boardNumber: number) {
        const players: Player[] = []
        _.each(this._teams, (team) => {
            if (boardNumber - 1 < team.players.length) {
                players.push(team.players[boardNumber - 1])
            }
        })
        return players
    }

    // -------------------------------------------------------------------------
    // Format the response for the list of captains
    // -------------------------------------------------------------------------
    formatCaptainsResponse() {
        if (this._teams.length === 0) {
            return `The ${this.name} league does not have captains`
        }
        let message = 'Team Captains:\n'
        let teamIndex = 1
        this._teams.forEach((team) => {
            const captainName = team.captain?.username || 'Unchosen'
            message +=
                '\t' +
                teamIndex++ +
                '. ' +
                team.name +
                ': ' +
                captainName +
                '\n'
        })
        return message
    }

    // -------------------------------------------------------------------------
    // Format the response for the list of captains
    // -------------------------------------------------------------------------
    formatTeamCaptainResponse(teamName: string) {
        if (this._teams.length === 0) {
            return `The {this.name} league does not have captains`
        }
        const teams = _.filter(this._teams, (t) =>
            _.isEqual(t.name.toLowerCase(), teamName.toLowerCase())
        )
        if (teams.length === 0) {
            return 'No team by that name'
        }
        if (teams.length > 1) {
            return 'Too many teams by that name'
        }
        const team = teams[0]
        if (team && team.captain) {
            return 'Captain of ' + team.name + ' is ' + team.captain.username
        } else {
            return team.name + ' has not chosen a team captain. '
        }
    }

    // -------------------------------------------------------------------------
    // Format the teams response
    // -------------------------------------------------------------------------
    formatTeamsResponse() {
        if (this._teams.length === 0) {
            return `The ${name} league does not have teams`
        }
        let message =
            'There are currently ' + this._teams.length + ' teams competing. \n'
        this._teams.forEach((team) => {
            message += '\t' + team.number + '. ' + team.name + '\n'
        })
        return message
    }

    // -------------------------------------------------------------------------
    // Format board response
    // -------------------------------------------------------------------------
    formatBoardResponse(boardNumber: number) {
        if (this._teams.length === 0) {
            return `The ${this.name} league does not have teams`
        }
        const players = this.getBoard(boardNumber)
        let message = `Board ${boardNumber}consists of... \n`
        players.sort((e1, e2) => {
            return e1.rating > e2.rating ? -1 : e1.rating < e2.rating ? 1 : 0
        })
        players.forEach((member) => {
            message +=
                '\t' +
                member.username +
                ': (Rating: ' +
                member.rating +
                '; Team: ' +
                member.team.name +
                ')\n'
        })
        return message
    }

    // -------------------------------------------------------------------------
    // Format team members response
    // -------------------------------------------------------------------------
    formatTeamMembersResponse(teamName: string) {
        if (this._teams.length === 0) {
            return `The ${this.name} league does not have teams`
        }
        const teams = _.filter(this._teams, (t) => {
            return _.isEqual(t.name.toLowerCase(), teamName.toLowerCase())
        })
        if (teams.length === 0) {
            return 'No team by that name'
        }
        if (teams.length > 1) {
            return 'Too many teams by that name'
        }
        const team = teams[0]
        let message = 'The members of ' + team.name + ' are \n'
        team.players.forEach((member, index) => {
            message +=
                '\tBoard ' +
                (index + 1) +
                ': ' +
                member.username +
                ' (' +
                this.getPlayer(member.username)?.rating +
                ')\n'
        })
        return message
    }

    // -------------------------------------------------------------------------
    // Format the mods message
    // -------------------------------------------------------------------------
    formatModsResponse() {
        const moderators = _.map(this._moderators, (name) => {
            return name[0] + '\u200B' + name.slice(1)
        })
        return (
            `${this.name} mods: ` +
            moderators.join(', ') +
            ' (**Note**: this does not ping the moderators. Use: `@chesster: summon mods` to ping them)'
        )
    }

    // -------------------------------------------------------------------------
    // Format the summon mods message
    // -------------------------------------------------------------------------
    formatSummonModsResponse() {
        const moderators = _.map(this._moderators, (name) => {
            return this.bot.users.getIdString(name)
        })
        return (
            `${this.name} mods: ` +
            moderators.join(', ') +
            ' Please wait for the mods to contact you. Do not send messages directly.'
        )
    }

    formatFAQResponse() {
        return `The FAQ for ${this.name} can be found: ${this.config.links.faq}`
    }
}

function isLeague(l: League | undefined): l is League {
    return l !== undefined
}

export function getAllLeagues(bot: SlackBot): League[] {
    const allLeagueConfigs = bot.config.leagues || {}
    return _(allLeagueConfigs)
        .keys()
        .map((key) => getLeague(bot, key))
        .filter(isLeague)
        .value()
}

export const getLeague = (() => {
    const _leagueCache: Record<string, League> = {}
    return (bot: SlackBot, leagueName: string): League | undefined => {
        if (!_leagueCache[leagueName]) {
            // Else create it if there is a config for it.
            const allLeagueConfigs = bot.config.leagues || {}
            let thisLeagueConfig = allLeagueConfigs[leagueName] || undefined
            if (thisLeagueConfig) {
                winston.info('Creating new league for ' + leagueName)
                thisLeagueConfig = _.clone(thisLeagueConfig)
                thisLeagueConfig.name = leagueName
                const league = new League(bot, leagueName, thisLeagueConfig)
                _leagueCache[leagueName] = league
            } else {
                return undefined
            }
        }
        return _leagueCache[leagueName]
    }
})()
