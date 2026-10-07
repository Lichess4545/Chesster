// -----------------------------------------------------------------------------
// Types for the chesster config.
// -----------------------------------------------------------------------------
import moment from 'moment'

export interface Heltour {
    baseEndpoint: string
}

export interface HeltourLeagueConfig extends Heltour {
    leagueTag: string
}

export interface Welcome {
    channel: string
}

export interface Results {
    channel: string
    channelId: string
}

export interface GameLinksClock {
    initial: number
    increment: number
}

export interface GameLinks {
    channel: string
    channelId: string
    clock: GameLinksClock
    rated: boolean
    variant: string
}

export interface SchedulingExtrema {
    isoWeekday: number
    hour: number
    minute: number
    warningHours: number
    referenceDate: moment.Moment | undefined
}

export interface Scheduling {
    extrema: SchedulingExtrema
    warningMessage: string
    lateMessage: string
    format: string
    channel: string
}

export interface Alternate {
    channelId: string
}

export interface LeagueLinks {
    faq: string
    rules: string
    league: string
    pairings: string
    standings: string
    guide: string
    captains: string
    registration: string
    availability: string
    nominate: string
    notifications: string
}

export interface League {
    name: string
    alsoKnownAs: string[]
    heltour: HeltourLeagueConfig
    results: Results
    gamelinks: GameLinks
    scheduling: Scheduling
    links: LeagueLinks
    alternate?: Alternate
}

export interface Winston {
    domain: string
    channel: string
    username: string
    level: 'error' | 'warning' | 'info' | 'debug'
    handleExceptions: boolean
}

export interface Links {
    source: string
}

export type ChannelMap = Record<string, string>

export interface MessageForwarding {
    channelId: string
}

export type ChannelModMap = Record<string, string[]>

export interface WatcherConfig {
    inactivityTimeoutMinutes: number
    maxBackoffSeconds: number
    healthLogIntervalMinutes: number
}

export const DEFAULT_WATCHER_CONFIG: WatcherConfig = {
    inactivityTimeoutMinutes: 10,
    maxBackoffSeconds: 60,
    healthLogIntervalMinutes: 5,
}

export interface ChessterConfig {
    heltour: Heltour
    storage: string
    watcherBaseURL: string
    winston: Winston
    links: Links
    leagues: Record<string, League>
    channelMap: ChannelMap
    messageForwarding: MessageForwarding
    pingMods: ChannelModMap
    welcome: Welcome
    watcher: WatcherConfig
}

export type ConfigName = 'production' | 'development'

// -----------------------------------------------------------------------------
// The heltour token is a secret that lives in the environment, never in the
// config. These runtime types describe the config once the token has been
// attached, which is what the rest of the application actually works with.
// -----------------------------------------------------------------------------
export type RuntimeHeltour = Heltour & { token: string }
export type RuntimeHeltourLeagueConfig = HeltourLeagueConfig & { token: string }
export type RuntimeLeague = Omit<League, 'heltour'> & {
    heltour: RuntimeHeltourLeagueConfig
}
export type RuntimeChessterConfig = Omit<ChessterConfig, 'heltour' | 'leagues'> & {
    heltour: RuntimeHeltour
    leagues: Record<string, RuntimeLeague>
}

export function withHeltourToken(
    config: ChessterConfig,
    heltourToken: string
): RuntimeChessterConfig {
    const leagues: Record<string, RuntimeLeague> = {}
    for (const key of Object.keys(config.leagues)) {
        const l = config.leagues[key]
        leagues[key] = {
            ...l,
            heltour: { ...l.heltour, token: heltourToken },
        }
    }
    return {
        ...config,
        heltour: { ...config.heltour, token: heltourToken },
        leagues,
    }
}

export type DatabaseSslMode = 'disable' | 'require' | 'verify' | 'prefer'

export function resolveDatabaseSslMode(sslmode: string | null): DatabaseSslMode {
    switch (sslmode) {
        case 'disable':
            return 'disable'
        case 'require':
        case 'no-verify':
            return 'require'
        case 'verify-ca':
        case 'verify-full':
            return 'verify'
        default:
            return 'prefer'
    }
}

export interface DatabaseSsl {
    rejectUnauthorized: boolean
    ca?: string
}

export function databaseSslOptions(
    mode: DatabaseSslMode,
    ca?: string
): DatabaseSsl | undefined {
    switch (mode) {
        case 'disable':
            return undefined
        case 'require':
        case 'prefer':
            return { rejectUnauthorized: false }
        case 'verify':
            return { rejectUnauthorized: true, ca }
    }
}

export function stripDatabaseSslParams(databaseUrl: string): string {
    const url = new URL(databaseUrl)
    url.searchParams.delete('sslmode')
    url.searchParams.delete('sslrootcert')
    return url.toString()
}

export function databaseSslRootCertPath(databaseUrl: string): string | undefined {
    return new URL(databaseUrl).searchParams.get('sslrootcert') || undefined
}

export function databaseSslMode(databaseUrl: string): DatabaseSslMode {
    return resolveDatabaseSslMode(new URL(databaseUrl).searchParams.get('sslmode'))
}

export function redactDatabaseUrl(databaseUrl: string): string {
    const url = new URL(databaseUrl)
    url.password = ''
    return url.toString()
}
