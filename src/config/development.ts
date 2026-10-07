import { ChessterConfig, League } from '../config'
import { production } from './production'

const UNSTABLE_BOT_ID = 'C016G6T5QTW'
const UNSTABLE_BOT_LONEWOLF_ID = 'C015V92UJUX'

const LONEWOLF_GAMES_CHANNEL_ID = 'C08JZJNU8UC'

const CHESS960_GAMES_CHANNEL_ID = 'C08KHN4FTUY'

const TEAM_GAMES_CHANNEL_ID = 'C08HXSVUH26'

const devHeltour = { baseEndpoint: 'http://127.0.0.1:8000/api/' }

function withDevHeltour(league: League): League {
    return {
        ...league,
        heltour: { ...devHeltour, leagueTag: league.heltour.leagueTag },
    }
}

export const development: ChessterConfig = {
    ...production,
    winston: {
        ...production.winston,
        channel: '#modster-logging',
        handleExceptions: false,
    },
    welcome: {
        channel: 'dev-testing-lonewolf',
    },
    heltour: devHeltour,
    leagues: {
        ...production.leagues,
        '45+45': {
            ...withDevHeltour(production.leagues['45+45']),
            scheduling: {
                ...production.leagues['45+45'].scheduling,
                channel: 'team-scheduling',
            },
            results: {
                channel: 'team-games',
                channelId: TEAM_GAMES_CHANNEL_ID,
            },
            gamelinks: {
                ...production.leagues['45+45'].gamelinks,
                channel: 'team-games',
                channelId: TEAM_GAMES_CHANNEL_ID,
            },
            alternate: {
                channelId: UNSTABLE_BOT_ID,
            },
        },
        lonewolf: {
            ...withDevHeltour(production.leagues.lonewolf),
            scheduling: {
                ...production.leagues.lonewolf.scheduling,
                channel: 'lonewolf-scheduling',
            },
            results: {
                channel: 'lonewolf-games',
                channelId: LONEWOLF_GAMES_CHANNEL_ID,
            },
            gamelinks: {
                ...production.leagues.lonewolf.gamelinks,
                channel: 'lonewolf-games',
                channelId: LONEWOLF_GAMES_CHANNEL_ID,
            },
        },
        blitzbattle: withDevHeltour(production.leagues.blitzbattle),
        chess960: {
            ...withDevHeltour(production.leagues.chess960),
            scheduling: {
                ...production.leagues.chess960.scheduling,
                channel: 'chess960scheduling',
            },
            results: {
                channel: 'chess960games',
                channelId: CHESS960_GAMES_CHANNEL_ID,
            },
            gamelinks: {
                ...production.leagues.chess960.gamelinks,
                channel: 'chess960games',
            },
        },
    },
    channelMap: {
        ...production.channelMap,
        [UNSTABLE_BOT_ID]: '45+45',
        'dev-testing': '45+45',
        'dev-testing-lonewolf': 'lonewolf',
        'dev-testing-blitz': 'blitz',
        [UNSTABLE_BOT_LONEWOLF_ID]: 'lonewolf',
    },
    pingMods: {
        C016G6T5QTW: ['U0164C6FXLK'],
    },
}
