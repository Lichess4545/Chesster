//------------------------------------------------------------------------------
// Defines a league object which can be used to interact with the website
// for the given league
//------------------------------------------------------------------------------
import _ from 'lodash'
import winston from 'winston'
import moment from 'moment-timezone'
import * as heltour from './heltour'
import * as lichess from './lichess'
import { EventEmitter } from 'events'
import { SlackBot, LeagueMember, localTime } from './slack'
import { LogWithPrefix } from './logging'
import { PartialBy } from './utils'

// An emitter for league events
class ChessLeagueEmitter extends EventEmitter {}

// TODO: these need to be typed out appropriately
type Channel = any
type RefreshError = any
type Roster = any

export interface Player {
    username: string
    rating: number
    team: Team
    isCaptain: boolean
    boardNumber?: number
}
export enum ResultsEnum {
    UNKNOWN = '-',
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
    // TODO: lone-wolf vs lonewolf
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
    captain: Player
    number: number
    slack_channel: string
}
type RefreshRostersCallback = () => void
type RefreshPairingsCallback = () => void

export interface SchedulingOptions {
    referenceDate?: moment.Moment
    warningMessage: string
    lateMessage: string
    isoWeekday: number
    hour: number
    minute: number
    warningHours: number
    channel: string
}

type SchedulingOptionsParameters = PartialBy<SchedulingOptions, 'referenceDate'>

export function makeSchedulingOptions({
    isoWeekday = 2,
    hour = 0,
    minute = 0,
    warningHours = 1.5,
    referenceDate,
    ...rest
}: SchedulingOptionsParameters) {
    return {
        isoWeekday,
        hour,
        minute,
        warningHours,
        referenceDate: referenceDate
            ? moment(referenceDate).clone()
            : moment.utc(),
        ...rest,
    }
}

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
        public also_known_as: string[],
        public heltour: heltour.Config,
        public links: LeagueLinks,
        public welcome: Record<string, string>,
        public alternate?: Record<string, string>,
        public results?: Record<string, string>,
        public gamelinks?: Record<string, any>, // TODO: remove any.
        public scheduling?: SchedulingOptions, // TODO: remove any.
        public channels: Channel[] = [],
        public _players: Player[] = [],
        public _pairings: Pairing[] = [],
        public _teams: Team[] = []
    ) {
        this.emitter = new ChessLeagueEmitter()
        this.log = new LogWithPrefix(`[League(${this.name})]`)
    }

    //--------------------------------------------------------------------------
    // A lookup from player username to a player object (from _players)
    //--------------------------------------------------------------------------
    _playerLookup: Record<string, Player> = {}

    //--------------------------------------------------------------------------
    // A lookup from a team name to the team object.
    //--------------------------------------------------------------------------
    _teamLookup: Record<string, Team> = {}

    //--------------------------------------------------------------------------
    // A list of moderator names
    //--------------------------------------------------------------------------
    _moderators: string[] = []

    //--------------------------------------------------------------------------
    // The datetime when we were last updated
    //--------------------------------------------------------------------------
    _lastUpdated: moment.Moment = moment.utc()
    emitter: ChessLeagueEmitter

    //--------------------------------------------------------------------------
    // Canonicalize the username
    //--------------------------------------------------------------------------
    canonicalUsername(username: string): string {
        username = username.split(' ')[0]
        return username.replace('*', '')
    }

    //--------------------------------------------------------------------------
    // Lookup a player by playerName
    //--------------------------------------------------------------------------
    getPlayer(username: string): Player | undefined {
        return this._playerLookup[_.toLower(username)]
    }

    //--------------------------------------------------------------------------
    // Register a refreshRosters event
    //--------------------------------------------------------------------------
    onRefreshRosters(fn: RefreshRostersCallback) {
        this.emitter.on('refreshRosters', fn)
    }

    //--------------------------------------------------------------------------
    // Register a refreshPairings event
    //--------------------------------------------------------------------------
    onRefreshPairings(fn: RefreshPairingsCallback) {
        this.emitter.on('refreshPairings', fn)
    }

    //--------------------------------------------------------------------------
    // Refreshes everything
    //--------------------------------------------------------------------------
    refresh() {
        return Promise.all([
            this.refreshRosters()
                .then(() => {
                    this._lastUpdated = moment.utc()
                    this.emitter.emit('refreshRosters', this)
                })
                .catch((error: RefreshError) => {
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
                .catch((error: RefreshError) => {
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
                .catch((error: RefreshError) => {
                    winston.error(
                        `${this.name}: Unable to refresh moderators: ${error}`
                    )
                    throw error
                }),
        ])
    }

    //--------------------------------------------------------------------------
    // Refreshes the latest roster information
    //--------------------------------------------------------------------------
    async refreshRosters() {
        let roster: Roster = await heltour.getRoster(
            this.heltour,
            this.heltour.leagueTag
        )
        this._players = roster.players
        var newPlayerLookup: Record<string, Player> = {}
        var newTeams: Team[] = []
        var newLookup: Record<string, Team> = {}
        roster.players.forEach((player: Player) => {
            var name = _.toLower(player.username)
            newPlayerLookup[_.toLower(name)] = player
        })
        this._playerLookup = newPlayerLookup
        _.each(roster.teams, (team) => {
            _.each(team.players, (teamPlayer) => {
                var player = this.getPlayer(teamPlayer.username)
                if (!player) return
                player.isCaptain = teamPlayer.isCaptain = teamPlayer.is_captain
                if (player.isCaptain) {
                    team.captain = player
                }
                teamPlayer.rating = player.rating
                player.boardNumber = teamPlayer.board_number
                teamPlayer.team = player.team = team
            })
            newTeams.push(team)
            newLookup[_.toLower(team.name)] = team
        })
        this.log.info('Setting new teams')
        this._teams = newTeams
        this._teamLookup = newLookup
    }

    //--------------------------------------------------------------------------
    // Calls into the website moderators endpoint to get the list of moderators
    // for the league.
    //--------------------------------------------------------------------------
    async refreshLeagueModerators() {
        let response = await heltour.getLeagueModerators(this.heltour)
        this._moderators = response.moderators.map((m) => m.toLowerCase())
    }

    //--------------------------------------------------------------------------
    // Figures out the current scheduling information for the round.
    //--------------------------------------------------------------------------
    async refreshCurrentRoundSchedules() {
        return heltour
            .getAllPairings(this.heltour, this.heltour.leagueTag)
            .then((pairings: heltour.Pairing[]) => {
                var newPairings: Pairing[] = []
                _.each(pairings, (heltourPairing) => {
                    var date = moment.utc(heltourPairing.datetime)
                    newPairings.push({
                        white: heltourPairing.white,
                        black: heltourPairing.black,
                        scheduledDate: date.isValid() ? date : undefined,
                        url: heltourPairing.game_link,
                        result: resultFromString(heltourPairing.result),
                    })
                })
                this._pairings = newPairings
                return this._pairings
            })
    }

    //--------------------------------------------------------------------------
    // Finds the pairing for this current round given either a black or a white
    // username.
    //--------------------------------------------------------------------------
    findPairing(white: string, black?: string): Pairing[] {
        if (!white) {
            throw new Error('findPairing requires at least one username.')
        }
        var possibilities = this._pairings
        let filter = (playerName: string) => {
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

    //--------------------------------------------------------------------------
    // Returns whether someone is a moderator or not.
    //--------------------------------------------------------------------------
    isModerator(name: string) {
        return _.includes(this._moderators, _.toLower(name))
    }

    //--------------------------------------------------------------------------
    // Prepare a debug message for this league
    //--------------------------------------------------------------------------
    formatDebugResponse(): string {
        let name = this.name
        let pairingsCount = this._pairings.length
        let lastUpdated = this._lastUpdated.format('YYYY-MM-DD HH:mm UTC')
        let since = this._lastUpdated.fromNow(true)
        return `DEBUG:\nLeague: ${name}\nTotal Pairings: ${pairingsCount}\nLast Updated: ${lastUpdated} [${since} ago]`
    }

    //--------------------------------------------------------------------------
    // Generates the appropriate data format for pairing result for this league.
    //--------------------------------------------------------------------------
    async getPairingDetails(
        lichessUsername: string
    ): Promise<PairingDetails | undefined> {
        return new Promise(async (resolve, reject) => {
            var pairings = this.findPairing(lichessUsername)
            if (pairings.length < 1) {
                return resolve(undefined)
            }
            // TODO: determine what to do if multiple pairings are returned. ?
            var pairing = pairings[0]
            var details: PairingDetails = {
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
                let rating = await lichess.getPlayerRating(details.opponent)
                details['rating'] = rating
                resolve(details)
            } catch (error) {
                winston.error(JSON.stringify(error))
            }
            resolve(undefined)
        })
    }

    //--------------------------------------------------------------------------
    // Formats the pairing result for this league
    //--------------------------------------------------------------------------
    formatPairingResponse(
        requestingPlayer: LeagueMember,
        details: PairingDetails
    ) {
        var time
        if (details.scheduledDate) {
            time = localTime(requestingPlayer, details.scheduledDate)
        }
        var schedule_phrase = ''
        var played_phrase = ''

        if (!time || !time.isValid()) {
            played_phrase = 'will play'
            schedule_phrase = '. The game is unscheduled.'
        } else if (moment.utc().isAfter(time)) {
            // If the match took place in the past, display the date instead of the day
            played_phrase = 'played'
            let localDateTimeString = time.format('YYYY-MM-DD [at] HH:mm')
            schedule_phrase = ` on ${localDateTimeString} in your timezone.`
        } else {
            played_phrase = 'will play'
            let localDateTimeString = time.format('MM/DD _(dddd)_ [at] HH:mm')
            let timeUntil = time.fromNow(true)
            schedule_phrase = ` on ${localDateTimeString} in your timezone, which is in ${timeUntil}.`
        }

        // Otherwise display the time until the match
        let opponent_color = details.color === 'white' ? 'black' : 'white'
        let rating = details.rating ? '(' + details.rating + ')' : ''
        return (
            `[${this.name}]: :${details.color}pieces: _${details.player}_ ${played_phrase} against ` +
            `:${opponent_color}pieces: _${details.opponent}_ ${rating}${schedule_phrase}`
        )
    }

    //--------------------------------------------------------------------------
    // Formats the captains Guidelines
    //--------------------------------------------------------------------------
    formatCaptainGuidelinesResponse() {
        if (this.links && this.links.captains) {
            return `Here are the captain's guidelines:\n${this.links.captains}`
        } else {
            return `The ${this.name} league does not have captains guidelines.`
        }
    }

    //--------------------------------------------------------------------------
    // Formats the pairings response
    //--------------------------------------------------------------------------
    formatPairingsLinkResponse() {
        if (this.links && this.links.league) {
            return (
                'The pairings can be found on the website:\n' +
                this.links.pairings +
                '\nAlternatively, try [ @chesster pairing [competitor] ]'
            )
        } else {
            return `The ${this.name} league does not have a pairings link.`
        }
    }

    //--------------------------------------------------------------------------
    // Formats the standings response
    //--------------------------------------------------------------------------
    formatStandingsLinkResponse() {
        if (this.links && this.links.league) {
            return (
                'The standings can be found on the website:\n' +
                this.links.standings
            )
        } else {
            return `The ${this.name} league does not have a standings link.`
        }
    }

    //--------------------------------------------------------------------------
    // Formats the rules link response
    //--------------------------------------------------------------------------
    formatRulesLinkResponse() {
        if (this.links.rules) {
            return `Here are the rules and regulations:\n${this.links.rules}`
        } else {
            return `The ${this.name} league does not have a rules link.`
        }
    }

    //--------------------------------------------------------------------------
    // Formats the starter guide message
    //--------------------------------------------------------------------------
    formatStarterGuideResponse() {
        if (this.links.guide) {
            return `Here is everything you need to know:\n${this.links.guide}`
        } else {
            return `The ${this.name} league does not have a starter guide.`
        }
    }

    //--------------------------------------------------------------------------
    // Formats the signup response
    //--------------------------------------------------------------------------
    formatRegistrationResponse() {
        if (this.links.registration) {
            return `You can sign up here:\n${this.links.registration}`
        } else {
            return `The ${this.name} league does not have an active signup form at the moment.`
        }
    }

    //--------------------------------------------------------------------------
    // Get a list of captain names
    //--------------------------------------------------------------------------
    getCaptains() {
        return this._teams.map((t) => t.captain)
    }

    //--------------------------------------------------------------------------
    // Get the list of teams
    //--------------------------------------------------------------------------
    getTeams() {
        return this._teams
    }

    //--------------------------------------------------------------------------
    // Get the team for a given player name
    //--------------------------------------------------------------------------
    getTeamByPlayerName(playerName: string) {
        playerName = playerName.toLowerCase()
        let teamName =
            this._playerLookup[playerName.toLowerCase()] &&
            this._playerLookup[playerName.toLowerCase()].team
        if (teamName) return teamName
        // Try to find the team by looking through the pairings for this
        // playername.  This will find alternates.
        let teams: Team[] = this._teams.filter((t) => {
            let playerIds = t.players.map((p) => p.username.toLowerCase())
            return playerIds.filter((n) => n === playerName)
        })
        if (teams.length > 0) {
            return teams[0]
        }
        return undefined
    }

    //--------------------------------------------------------------------------
    // Get the team for a given team name
    //--------------------------------------------------------------------------
    getTeam(teamName: string) {
        return this._teamLookup[teamName.toLowerCase()]
    }

    //--------------------------------------------------------------------------
    // Get the the players from a particular board
    //--------------------------------------------------------------------------
    getBoard(boardNumber: number) {
        var players: Player[] = []
        _.each(this._teams, (team) => {
            if (boardNumber - 1 < team.players.length) {
                players.push(team.players[boardNumber - 1])
            }
        })
        return players
    }

    //--------------------------------------------------------------------------
    // Format the response for the list of captains
    //--------------------------------------------------------------------------
    formatCaptainsResponse() {
        if (this._teams.length === 0) {
            return `The ${this.name} league does not have captains`
        }
        var message = 'Team Captains:\n'
        var teamIndex = 1
        this._teams.forEach((team) => {
            let captainName = team.captain?.username || 'Unchosen'
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

    //--------------------------------------------------------------------------
    // Format the response for the list of captains
    //--------------------------------------------------------------------------
    formatTeamCaptainResponse(teamName: string) {
        if (this._teams.length === 0) {
            return `The {this.name} league does not have captains`
        }
        var teams = _.filter(this._teams, (t) =>
            _.isEqual(t.name.toLowerCase(), teamName.toLowerCase())
        )
        if (teams.length === 0) {
            return 'No team by that name'
        }
        if (teams.length > 1) {
            return 'Too many teams by that name'
        }
        var team = teams[0]
        if (team && team.captain) {
            return 'Captain of ' + team.name + ' is ' + team.captain.username
        } else {
            return team.name + ' has not chosen a team captain. '
        }
    }

    //--------------------------------------------------------------------------
    // Format the teams response
    //--------------------------------------------------------------------------
    formatTeamsResponse() {
        if (this._teams.length === 0) {
            return `The ${name} league does not have teams`
        }
        var message =
            'There are currently ' + this._teams.length + ' teams competing. \n'
        this._teams.forEach((team) => {
            message += '\t' + team.number + '. ' + team.name + '\n'
        })
        return message
    }

    //--------------------------------------------------------------------------
    // Format board response
    //--------------------------------------------------------------------------
    formatBoardResponse(boardNumber: number) {
        if (this._teams.length === 0) {
            return `The ${this.name} league does not have teams`
        }
        let players = this.getBoard(boardNumber)
        var message = `Board ${boardNumber}consists of... \n`
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

    //--------------------------------------------------------------------------
    // Format team members response
    //--------------------------------------------------------------------------
    formatTeamMembersResponse(teamName: string) {
        if (this._teams.length === 0) {
            return `The ${this.name} league does not have teams`
        }
        var teams = _.filter(this._teams, (t) => {
            return _.isEqual(t.name.toLowerCase(), teamName.toLowerCase())
        })
        if (teams.length === 0) {
            return 'No team by that name'
        }
        if (teams.length > 1) {
            return 'Too many teams by that name'
        }
        var team = teams[0]
        var message = 'The members of ' + team.name + ' are \n'
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

    //--------------------------------------------------------------------------
    // Format the mods message
    //--------------------------------------------------------------------------
    formatModsResponse() {
        var moderators = _.map(this._moderators, (name) => {
            return name[0] + '\u200B' + name.slice(1)
        })
        return (
            `${this.name} mods: ` +
            moderators.join(', ') +
            ' (**Note**: this does not ping the moderators. Use: `@chesster: summon mods` to ping them)'
        )
    }

    //--------------------------------------------------------------------------
    // Format the summon mods message
    //--------------------------------------------------------------------------
    formatSummonModsResponse() {
        var moderators = _.map(this._moderators, (name) => {
            return this.bot.users.getIdString(name)
        })
        return (
            `{this.name} mods: ` +
            moderators.join(', ') +
            ' Please wait for the mods to contact you. Do not send messages directly.'
        )
    }

    formatFAQResponse() {
        return `The FAQ for ${this.name} can be found: ${this.links.faq}`
    }
}

function isLeague(l: League | undefined): l is League {
    return l !== undefined
}

export function getAllLeagues(bot: SlackBot): League[] {
    var all_league_configs = bot.config['leagues'] || {}
    return _(all_league_configs)
        .keys()
        .map((key) => getLeague(bot, key))
        .filter(isLeague)
        .value()
}

export let getLeague = (function () {
    var _league_cache: Record<string, League> = {}
    return (bot: SlackBot, leagueName: string): League | undefined => {
        if (!_league_cache[leagueName]) {
            // Else create it if there is a config for it.
            var all_league_configs = bot.config['leagues'] || {}
            var this_league_config = all_league_configs[leagueName] || undefined
            if (this_league_config) {
                winston.info('Creating new league for ' + leagueName)
                this_league_config = _.clone(this_league_config)
                this_league_config.name = leagueName
                var league = new League(
                    bot,
                    leagueName,
                    this_league_config.also_known_as,
                    this_league_config.heltour,
                    this_league_config.links,
                    this_league_config.alternate,
                    this_league_config.welcome,
                    this_league_config.results,
                    this_league_config.gamelinks,
                    this_league_config.scheduling?.extrema
                )
                _league_cache[leagueName] = league
            } else {
                return undefined
            }
        }
        return _league_cache[leagueName]
    }
})()
