// -----------------------------------------------------------------------------
// Types and parsing for the chesster config.
// -----------------------------------------------------------------------------
import moment from 'moment'
import {
    Decoder,
    array,
    object,
    number,
    string,
    boolean,
    andThen,
    oneOf,
    dict,
    succeed,
} from 'type-safe-json-decoder'

export interface Heltour {
    token: string
    baseEndpoint: string
}

export interface HeltourLeagueConfig extends Heltour {
    leagueTag: string
}

export function heltourDecoder(heltourToken: string): Decoder<Heltour> {
    return object(
        ['baseEndpoint', string()],
        (baseEndpoint) => ({ token: heltourToken, baseEndpoint })
    )
}
export function heltourLeagueConfigDecoder(
    heltourToken: string
): Decoder<HeltourLeagueConfig> {
    return andThen(heltourDecoder(heltourToken), (heltour) =>
        object(['leagueTag', string()], (leagueTag) => ({
            ...heltour,
            leagueTag,
        }))
    )
}

export interface Welcome {
    channel: string
}
export const WelcomeDecoder: Decoder<Welcome> = object(
    ['channel', string()],
    (channel) => ({ channel })
)

export interface Results {
    channel: string
    channelId: string
}
export const ResultsDecoder: Decoder<Results> = object(
    ['channel', string()],
    ['channelId', string()],
    (channel, channelId) => ({ channel, channelId })
)

export interface GameLinksClock {
    initial: number
    increment: number
}
export const GameLinksClockDecoder: Decoder<GameLinksClock> = object(
    ['initial', number()],
    ['increment', number()],
    (initial, increment) => ({ initial, increment })
)

export interface GameLinks {
    channel: string
    channelId: string
    clock: GameLinksClock
    rated: boolean
    variant: string
}
export const GameLinksDecoder: Decoder<GameLinks> = object(
    ['channel', string()],
    ['channelId', string()],
    ['clock', GameLinksClockDecoder],
    ['rated', boolean()],
    ['variant', string()],
    (channel, channelId, clock, rated, variant) => ({
        channel,
        channelId,
        clock,
        rated,
        variant,
    })
)

export interface SchedulingExtrema {
    isoWeekday: number
    hour: number
    minute: number
    warningHours: number
    referenceDate: moment.Moment | undefined
}
export const SchedulingExtremaDecoder: Decoder<SchedulingExtrema> = object(
    ['isoWeekday', number()],
    ['hour', number()],
    ['minute', number()],
    ['warningHours', number()],
    (isoWeekday, hour, minute, warningHours) => ({
        isoWeekday,
        hour,
        minute,
        warningHours,
        referenceDate: undefined,
    })
)
export interface Scheduling {
    extrema: SchedulingExtrema
    warningMessage: string
    lateMessage: string
    format: string
    channel: string
}
export const SchedulingDecoder: Decoder<Scheduling> = object(
    ['extrema', SchedulingExtremaDecoder],
    ['warningMessage', string()],
    ['lateMessage', string()],
    ['format', string()],
    ['channel', string()],
    (extrema, warningMessage, lateMessage, format, channel) => ({
        extrema,
        warningMessage,
        lateMessage,
        format,
        channel,
    })
)
export interface Alternate {
    channelId: string
}
export const AlternateDecoder: Decoder<Alternate> = object(
    ['channelId', string()],
    (channelId) => ({ channelId })
)
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
export const LeagueLinksDecoder: Decoder<LeagueLinks> = object(
    ['faq', string()],
    ['rules', string()],
    ['league', string()],
    ['pairings', string()],
    ['standings', string()],
    ['guide', string()],
    ['captains', string()],
    ['registration', string()],
    ['availability', string()],
    ['nominate', string()],
    ['notifications', string()],
    (
        faq,
        rules,
        league,
        pairings,
        standings,
        guide,
        captains,
        registration,
        availability,
        nominate,
        notifications
    ) => ({
        faq,
        rules,
        league,
        pairings,
        standings,
        guide,
        captains,
        registration,
        availability,
        nominate,
        notifications,
    })
)

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

export function leagueWithoutAlternateDecoder(
    heltourToken: string
): Decoder<League> {
    return object(
        ['name', string()],
        ['alsoKnownAs', array(string())],
        ['heltour', heltourLeagueConfigDecoder(heltourToken)],
        ['results', ResultsDecoder],
        ['gamelinks', GameLinksDecoder],
        ['scheduling', SchedulingDecoder],
        ['links', LeagueLinksDecoder],
        (
            name,
            alsoKnownAs,
            heltour,
            results,
            gamelinks,
            scheduling,
            links
        ) => ({
            name,
            alsoKnownAs,
            heltour,
            results,
            gamelinks,
            scheduling,
            links,
            alternate: undefined,
        })
    )
}
export function leagueWithAlternateDecoder(
    heltourToken: string
): Decoder<League> {
    return andThen(
        leagueWithoutAlternateDecoder(heltourToken),
        (leagueWithoutAlternate) =>
            object(['alternate', AlternateDecoder], (alternate) => ({
                ...leagueWithoutAlternate,
                alternate,
            }))
    )
}
export function leagueDecoder(heltourToken: string): Decoder<League> {
    return oneOf(
        leagueWithAlternateDecoder(heltourToken),
        leagueWithoutAlternateDecoder(heltourToken)
    )
}

export interface Winston {
    domain: string
    channel: string
    username: string
    level: 'error' | 'warning' | 'info' | 'debug'
    handleExceptions: boolean
}
export const WinstonDecoder: Decoder<Winston> = object(
    ['domain', string()],
    ['channel', string()],
    ['username', string()],
    ['level', string()],
    ['handleExceptions', boolean()],
    (domain, channel, username, level, handleExceptions) => ({
        domain,
        channel,
        username,
        level: level as 'error' | 'warning' | 'info' | 'debug',
        handleExceptions,
    })
)
export interface Links {
    source: string
}
export const LinksDecoder: Decoder<Links> = object(
    ['source', string()],
    (source) => ({ source })
)
export type ChannelMap = Record<string, string>
export const ChannelMapDecoder: Decoder<ChannelMap> = dict(string())

export interface MessageForwarding {
    channelId: string
}
export const MessageForwardingDecoder: Decoder<MessageForwarding> = object(
    ['channelId', string()],
    (channelId) => ({ channelId })
)

export type ChannelModMap = Record<string, string[]>
export const ChannelModMapDecoder: Decoder<ChannelModMap> = dict(
    array(string())
)

export interface WatcherConfig {
    inactivityTimeoutMinutes: number
    maxBackoffSeconds: number
    healthLogIntervalMinutes: number
}
export const WatcherConfigDecoder: Decoder<WatcherConfig> = object(
    ['inactivityTimeoutMinutes', number()],
    ['maxBackoffSeconds', number()],
    ['healthLogIntervalMinutes', number()],
    (inactivityTimeoutMinutes, maxBackoffSeconds, healthLogIntervalMinutes) => ({
        inactivityTimeoutMinutes,
        maxBackoffSeconds,
        healthLogIntervalMinutes,
    })
)
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

function baseChessterConfigDecoder(
    heltourToken: string
): Decoder<Omit<ChessterConfig, 'watcher'>> {
    return object(
        ['heltour', heltourDecoder(heltourToken)],
        ['storage', string()],
        ['watcherBaseURL', string()],
        ['winston', WinstonDecoder],
        ['links', LinksDecoder],
        ['leagues', dict(leagueDecoder(heltourToken))],
        ['channelMap', ChannelMapDecoder],
        ['messageForwarding', MessageForwardingDecoder],
        ['pingMods', ChannelModMapDecoder],
        ['welcome', WelcomeDecoder],
        (
            heltour,
            storage,
            watcherBaseURL,
            winston,
            links,
            leagues,
            channelMap,
            messageForwarding,
            pingMods,
            welcome
        ) => ({
            heltour,
            storage,
            watcherBaseURL,
            winston,
            links,
            leagues,
            channelMap,
            messageForwarding,
            pingMods,
            welcome,
        })
    )
}

function chessterConfigWithWatcherDecoder(
    heltourToken: string
): Decoder<ChessterConfig> {
    return andThen(baseChessterConfigDecoder(heltourToken), (base) =>
        object(['watcher', WatcherConfigDecoder], (watcher) => ({
            ...base,
            watcher,
        }))
    )
}

function chessterConfigWithDefaultsDecoder(
    heltourToken: string
): Decoder<ChessterConfig> {
    return andThen(baseChessterConfigDecoder(heltourToken), (base) =>
        succeed({
            ...base,
            watcher: DEFAULT_WATCHER_CONFIG,
        })
    )
}

export function chessterConfigDecoder(
    heltourToken: string
): Decoder<ChessterConfig> {
    return oneOf(
        chessterConfigWithWatcherDecoder(heltourToken),
        chessterConfigWithDefaultsDecoder(heltourToken)
    )
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
