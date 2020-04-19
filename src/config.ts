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
import { Config as Heltour } from './heltour'

export const HeltourDecoder: Decoder<Heltour> = object(
    ['token', string()],
    ['baseEndpoint', string()],
    ['leagueTag', string()],
    (token, baseEndpoint, leagueTag) => ({ token, baseEndpoint, leagueTag })
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

export interface LeagueWithoutWelcome {
    name: string
    alsoKnownAs: string[]
    heltour: Heltour
    results: Results
}

export const LeagueWithoutWelcomeDecoder: Decoder<LeagueWithoutWelcome> = object(
    ['name', string()],
    ['alsoKnownAs', array(string())],
    ['heltour', HeltourDecoder],
    ['results', ResultsDecoder],
    (name, alsoKnownAs, heltour, results) => ({
        name,
        alsoKnownAs,
        heltour,
        results,
    })
)
export interface LeagueWithWelcome extends LeagueWithoutWelcome {
    welcome: Welcome
}
export const LeagueWithWelcomeDecoder: Decoder<LeagueWithoutWelcome> = andThen(
    LeagueWithoutWelcomeDecoder,
    (leagueWithoutWelcome) =>
        object(['welcome', WelcomeDecoder], (welcome) => ({
            ...leagueWithoutWelcome,
            welcome,
        }))
)
export type League = LeagueWithWelcome | LeagueWithoutWelcome
export const LeagueDecoder: Decoder<League> = oneOf(
    LeagueWithoutWelcomeDecoder,
    LeagueWithoutWelcomeDecoder
)
export interface SlackTokens {
    lichess4545: string
    chesster: string
}
export const SlackTokensDecoder: Decoder<SlackTokens> = object(
    ['lichess4545', string()],
    ['chesster', string()],
    (lichess4545, chesster) => ({
        lichess4545,
        chesster,
    })
)
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
}
export const DatabaseDecoder: Decoder<Database> = object(
    ['name', string()],
    ['username', string()],
    ['password', string()],
    ['host', string()],
    ['dialect', string()],
    ['logging', boolean()],
    (name, username, password, host, dialect, logging) => ({
        name,
        username,
        password,
        host,
        dialect,
        logging,
    })
)

export interface ChessterConfig {
    database: Database
    pool: Pool
    storage: string
    watcherBaseURL: string
    slackTokens: SlackTokens
    winston: Winston
    links: Links
    leagues: Record<string, League>
    channelMap: ChannelMap
    messageForwarding: MessageForwarding
}
export const ChessterConfigDecoder: Decoder<ChessterConfig> = object(
    ['database', DatabaseDecoder],
    ['pool', PoolDecoder],
    ['storage', string()],
    ['watcherBaseURL', string()],
    ['slackTokens', SlackTokensDecoder],
    ['winston', WinstonDecoder],
    ['links', LinksDecoder],
    ['leagues', dict(LeagueDecoder)],
    ['channelMap', ChannelMapDecoder],
    ['messageForwarding', MessageForwardingDecoder],
    (
        database,
        pool,
        storage,
        watcherBaseURL,
        slackTokens,
        winston,
        links,
        leagues,
        channelMap,
        messageForwarding
    ) => ({
        database,
        pool,
        storage,
        watcherBaseURL,
        slackTokens,
        winston,
        links,
        leagues,
        channelMap,
        messageForwarding,
    })
)
