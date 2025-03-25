// NOTE: None of these files are committed and for good reason.
// You must provide your own.
const dotenv = require('dotenv')
dotenv.config()
let db = require('./db.js')

// These variables are unused but I'm too chicken to delete them
let _4545_SLACK_TOKEN =
    process.env.CHESSTER_4545_SLACK_TOKEN || "It won't work without this token"
let CHESSTER_SLACK_TOKEN =
    process.env.CHESSTER_CHESSTER_SLACK_TOKEN ||
    "It won't work without this token"
let HELTOUR_TOKEN =
    process.env.CHESSTER_HELTOUR_TOKEN || "It won't work without this token"

let LICHESS_TOKEN =
    process.env.CHESSTER_LICHESS_TOKEN || "It won't work without this token"

var config = {
    // Unfortunately this all has to be at the top level due to sequelize-cli
    // TODO: this should be a URL and should be from process.env long term
    database: db.development,
    storage: '',
    watcherBaseURL: 'https://lichess.org/api/stream/games-by-users',
    watcherToken: LICHESS_TOKEN,

    // These are never actually used, the variables are accessed another way
    slackTokens: {
        lichess4545: _4545_SLACK_TOKEN,
        chesster: CHESSTER_SLACK_TOKEN,
    },
    winston: {
        domain: 'chesster',
        channel: '#lichess4545-logging',
        username: 'chesster',
        level: 'debug',
        handleExceptions: true,
    },
    links: {
        source: 'https://github.com/Lichess4545/Chesster',
    },
    heltour: {
        token: HELTOUR_TOKEN,
        baseEndpoint: 'https://www.lichess4545.com/api/',
    },
    welcome: {
        channel: 'general',
    },
    leagues: {
        '45+45': {
            name: '45+45',
            alsoKnownAs: ['4545', 'Team', '45'],
            heltour: {
                token: HELTOUR_TOKEN,
                baseEndpoint: 'https://www.lichess4545.com/api/',
                leagueTag: 'team4545',
            },
            results: {
                channel: 'team-games',
                channelId: 'C0CSAHD43',
            },
            gamelinks: {
                channel: 'team-games',
                channelId: 'C0CSAHD43',
                clock: {
                    initial: 1,
                    increment: 0,
                },
                rated: true,
                variant: 'standard',
            },
            scheduling: {
                extrema: {
                    isoWeekday: 1,
                    hour: 11,
                    minute: 0,
                    warningHours: 1,
                },
                warningMessage:
                    "Hi! Glad you got your game scheduled. Be warned though - it's cutting it pretty close to deadline! Please be on time and prompt with your game time, the league depends on it! Thanks, and if you have any questions, please contact the moderators.",
                lateMessage:
                    "Hi! Sorry, that is not an acceptable time. It looks like if you start at that time, you won't be done by the end of the round! If you are scheduling for today, I sometimes get confused - try using the date and time format 'yyyy-mm-dd hhmm'. Otherwise, please try and find a better time, and if you cannot, please contact the moderators.",
                format: 'MM/DD @ HH:mm',
                channel: 'team-scheduling',
            },
            alternate: {
                channelId: 'G0DFRURGQ',
            },
            links: {
                faq: 'https://www.lichess4545.com/team4545/document/faq/',
                rules: 'https://www.lichess4545.com/team4545/document/rules/',
                league: 'https://www.lichess4545.com/team4545/',
                pairings: 'https://www.lichess4545.com/team4545/pairings/',
                standings: 'https://www.lichess4545.com/team4545/standings/',
                guide: 'https://www.lichess4545.com/team4545/document/player-handbook/',
                captains:
                    'https://www.lichess4545.com/team4545/document/captains/',
                registration: 'https://www.lichess4545.com/team4545/register/',
                availability:
                    'https://www.lichess4545.com/team4545/availability/edit/',
                nominate: 'https://www.lichess4545.com/team4545/nominate/',
                notifications:
                    'https://www.lichess4545.com/team4545/notifications/',
            },
        },
        lonewolf: {
            name: 'Lone Wolf',
            alsoKnownAs: ['lonewolf', '3030', '30', 'lw', 'lonewolf', 'wolf'],
            alternate: undefined,
            heltour: {
                token: HELTOUR_TOKEN,
                baseEndpoint: 'https://www.lichess4545.com/api/',
                leagueTag: 'lonewolf',
            },
            results: {
                channel: 'lonewolf-games',
                channelId: 'C0SD3SCAH',
            },
            gamelinks: {
                channel: 'lonewolf-games',
                channelId: 'C0SD3SCAH',
                clock: {
                    // Events API TODO: Change time controls back from 1+0
                    initial: 1,
                    increment: 0,
                },
                rated: true,
                variant: 'standard',
            },
            scheduling: {
                extrema: {
                    isoWeekday: 1,
                    hour: 22,
                    minute: 0,
                    warningHours: 1,
                },
                warningMessage:
                    "Hi! Glad you got your game scheduled. Be warned though - it's cutting it pretty close to deadline! Please be on time and prompt with your game time, the league depends on it! Thanks, and if you have any questions, please contact the moderators.",
                lateMessage:
                    "Hi! Sorry, that time you posted is not an acceptable time. We need all games to end by 23:00 GMT on Monday, and we believe if you start then, you won't be done then! Please try and find a better time, and if you cannot, please contact the moderators.",
                format: 'MM/DD HH:mm',
                channel: 'lonewolf-scheduling',
            },
            alternate: undefined,
            links: {
                faq: 'https://www.lichess4545.com/lonewolf/document/faq/',
                rules: 'https://www.lichess4545.com/lonewolf/document/rules/',
                league: 'https://www.lichess4545.com/lonewolf/',
                pairings: 'https://www.lichess4545.com/lonewolf/pairings/',
                standings: 'https://www.lichess4545.com/lonewolf/standings/',
                guide: '',
                captains: '',
                registration: 'https://www.lichess45454.com/lonewolf/register/',
                availability:
                    'https://www.lichess4545.com/lonewolf/availability/edit/',
                nominate: 'https://www.lichess4545.com/lonewolf/nominate/',
                notifications:
                    'https://www.lichess4545.com/lonewolf/notifications/',
            },
        },
        blitzbattle: {
            name: 'Blitz Battle',
            alsoKnownAs: ['blitz', '32'],
            alternate: undefined,
            heltour: {
                token: HELTOUR_TOKEN,
                baseEndpoint: 'https://www.lichess4545.com/api/',
                leagueTag: 'blitzbattle',
            },
            results: {
                channel: 'blitz-battle-games',
                channelId: 'C3TV7T648',
            },
            gamelinks: {
                channel: 'blitz-battle-games',
                channelId: 'C3TV7T648',
                clock: {
                    initial: 3,
                    increment: 2,
                },
                rated: true,
                variant: 'standard',
            },
            alternate: undefined,
            scheduling: {
                extrema: {
                    isoWeekday: 0,
                    hour: 0,
                    minute: 0,
                    warningHours: 0,
                },
                warningMessage: '',
                lateMessage: '',
                format: '',
                channel: '',
            },
            links: {
                faq: 'https://www.lichess4545.com/blitzbattle/document/faq/',
                rules: 'https://www.lichess4545.com/blitzbattle/document/rules/',
                league: 'https://www.lichess4545.com/blitzbattle/',
                pairings: 'https://www.lichess4545.com/blitzbattle/pairings/',
                standings: 'https://www.lichess4545.com/blitzbattle/standings/',
                guide: '',
                captains: '',
                registration:
                    'https://www.lichess45454.com/blitzbattle/register/',
                availability:
                    'https://www.lichess4545.com/blitzbattle/availability/edit/',
                nominate: 'https://www.lichess4545.com/blitzbattle/nominate/',
                notifications:
                    'https://www.lichess4545.com/blitzbattle/notifications/',
            },
        },
        chess960: {
            name: 'Lichess 960',
            alsoKnownAs: ['960', '1515'],
            alternate: undefined,
            heltour: {
                token: HELTOUR_TOKEN,
                baseEndpoint: 'https://www.lichess4545.com/api/',
                leagueTag: 'chess960',
            },
            results: {
                channel: 'chess960games',
                channelId: 'C08KHN4FTUY',
            },
            gamelinks: {
                channel: 'chess960games',
                channelId: 'C08KHN4FTUY',
                clock: {
                    initial: 1,
                    increment: 0,
                },
                rated: true,
                variant: 'chess960',
            },
            scheduling: {
                extrema: {
                    isoWeekday: 1,
                    hour: 17,
                    minute: 0,
                    warningHours: 1,
                },
                warningMessage:
                    "Hi! Glad you got your game scheduled. Be warned though - it's cutting it pretty close to deadline! Please be on time and prompt with your game time, the league depends on it! Thanks, and if you have any questions, please contact the moderators.",
                lateMessage:
                    "Hi! Sorry, that time you posted is not an acceptable time. We need all games to end by 23:00 GMT on Monday, and we believe if you start then, you won't be done then! Please try and find a better time, and if you cannot, please contact the moderators.",
                format: 'MM/DD HH:mm',
                channel: 'chess960scheduling',
            },
            alternate: undefined,
            links: {
                faq: 'https://www.lichess4545.com/chess960/document/faq/',
                rules: 'https://www.lichess4545.com/chess960/document/rules/',
                league: 'https://www.lichess4545.com/chess960/',
                pairings: 'https://www.lichess4545.com/chess960/pairings/',
                standings: 'https://www.lichess4545.com/chess960/standings/',
                guide: '',
                captains: '',
                registration: 'https://www.lichess45454.com/chess960/register/',
                availability:
                    'https://www.lichess4545.com/chess960/availability/edit/',
                nominate: 'https://www.lichess4545.com/chess960/nominate/',
                notifications:
                    'https://www.lichess4545.com/chess960/notifications/',
            },
        },
    },
    channelMap: {
        'lonewolf-general': 'lonewolf',
        'lonewolf-games': 'lonewolf',
        'lonewolf-scheduling': 'lonewolf',
        'blitz-battle': 'blitzbattle',
        'blitz-battle-games': 'blitzbattle',
        general: '45+45',
        'team-general': '45+45',
        'team-games': '45+45',
        'team-scheduling': '45+45',
        captains: '45+45',
        G0DFRURGQ: '45+45',
        chess960: 'chess960',
        chess960games: 'chess960',
        chess960scheduling: 'chess960',
    },
    messageForwarding: {
        channelId: 'C08HZL49YH0',
    },
    pingMods: {
        C0VCCPMJ8: ['U0J2J60F8'],
    },
}
module.exports = config
