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
} from 'type-safe-json-decoder'

export interface Heltour {
    token: string
    baseEndpoint: string
}

export interface HeltourLeagueConfig extends Heltour {
    leagueTag: string
}

export const HeltourDecoder: Decoder<Heltour> = object(
    ['token', string()],
    ['baseEndpoint', string()],
    (token, baseEndpoint) => ({ token, baseEndpoint })
)
export const HeltourLeagueConfigDecoder: Decoder<HeltourLeagueConfig> = andThen(
    HeltourDecoder,
    (heltour) =>
        object(['leagueTag', string()], (leagueTag) => ({
            ...heltour,
            leagueTag,
        }))
)

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

export const LeagueWithoutAlternateDecoder: Decoder<League> = object(
    ['name', string()],
    ['alsoKnownAs', array(string())],
    ['heltour', HeltourLeagueConfigDecoder],
    ['results', ResultsDecoder],
    ['gamelinks', GameLinksDecoder],
    ['scheduling', SchedulingDecoder],
    ['links', LeagueLinksDecoder],
    (name, alsoKnownAs, heltour, results, gamelinks, scheduling, links) => ({
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
export const LeagueWithAlternateDecoder: Decoder<League> = andThen(
    LeagueWithoutAlternateDecoder,
    (leagueWithoutAlternate) =>
        object(['alternate', AlternateDecoder], (alternate) => ({
            ...leagueWithoutAlternate,
            alternate,
        }))
)
export const LeagueDecoder: Decoder<League> = oneOf(
    LeagueWithAlternateDecoder,
    LeagueWithoutAlternateDecoder
)
export type SlackTokens = Record<string, string>
export const SlackTokensDecoder: Decoder<SlackTokens> = dict(string())
export interface Winston {
    domain: string
    channel: string
    username: string
    level: string
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
        level,
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
export interface Pool {
    max: number
    min: number
    idle: number
}
export const PoolDecoder: Decoder<Pool> = object(
    ['max', number()],
    ['min', number()],
    ['idle', number()],
    (max, min, idle) => ({ max, min, idle })
)
export interface Database {
    name: string
    username: string
    password: string
    host: string
    dialect: string
    logging: boolean
    pool: Pool
}
export const DatabaseDecoder: Decoder<Database> = object(
    ['name', string()],
    ['username', string()],
    ['password', string()],
    ['host', string()],
    ['dialect', string()],
    ['logging', boolean()],
    ['pool', PoolDecoder],
    (name, username, password, host, dialect, logging, pool) => ({
        name,
        username,
        password,
        host,
        dialect,
        logging,
        pool,
    })
)

export interface ChessterConfig {
    database: Database
    heltour: Heltour
    storage: string
    watcherBaseURL: string
    slackTokens: SlackTokens
    winston: Winston
    links: Links
    leagues: Record<string, League>
    channelMap: ChannelMap
    messageForwarding: MessageForwarding
    welcome: Welcome
}
export const ChessterConfigDecoder: Decoder<ChessterConfig> = object(
    ['database', DatabaseDecoder],
    ['heltour', HeltourDecoder],
    ['storage', string()],
    ['watcherBaseURL', string()],
    ['slackTokens', SlackTokensDecoder],
    ['winston', WinstonDecoder],
    ['links', LinksDecoder],
    ['leagues', dict(LeagueDecoder)],
    ['channelMap', ChannelMapDecoder],
    ['messageForwarding', MessageForwardingDecoder],
    ['welcome', WelcomeDecoder],
    (
        database,
        heltour,
        storage,
        watcherBaseURL,
        slackTokens,
        winston,
        links,
        leagues,
        channelMap,
        messageForwarding,
        welcome
    ) => ({
        database,
        heltour,
        storage,
        watcherBaseURL,
        slackTokens,
        winston,
        links,
        leagues,
        channelMap,
        messageForwarding,
        welcome,
    })
)
