import { assert } from 'chai'
import { ChessterConfigDecoder } from '../src/config'

describe('config types', function () {
    let config = {
        // Unfortunately this all has to be at the top level due to sequelize-cli
        database: {
            name: 'chesster',
            username: 'chesster',
            password: 'asdfasdf',
            host: 'localhost',
            dialect: 'postgres',
            logging: false,
            pool: {
                max: 5,
                min: 0,
                idle: 10000,
            },
        },
        storage: '',
        watcherBaseURL: 'https://lichess.org/api/stream/games-by-users',
        watcherToken: 'asdfasdfasdfasdf',

        // These are never actually used
        slackTokens: {
            lichess4545: 'foo',
            chesster: 'foo',
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
        welcome: {
            channel: 'general',
        },
        heltour: {
            token: 'foo',
            baseEndpoint: 'http://localhost:8000/api/',
        },
        leagues: {
            '45+45': {
                name: '45+45',
                alsoKnownAs: ['4545', 'Team', '45'],
                heltour: {
                    token: 'foo',
                    baseEndpoint: 'http://localhost:8000/api/',
                    leagueTag: 'team4545',
                },
                results: {
                    channel: 'team-games',
                    channelId: 'C0CSAHD43',
                },
                gamelinks: {
                    channel: 'team-games',
                    channelId: 'C0CSAHD43',
                    // TODO events API: Change this time control back from bullet when done testing
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
                        "Hi! Sorry, that time you posted is not an acceptable time. We need all games to end by 12:00 GMT on Monday, and we believe if you start then, you won't be done then! Please try and find a better time, and if you cannot, please contact the moderators.",
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
                    standings:
                        'https://www.lichess4545.com/team4545/standings/',
                    guide: 'https://www.lichess4545.com/team4545/document/player-handbook/',
                    captains:
                        'https://www.lichess4545.com/team4545/document/captains/',
                    registration:
                        'https://www.lichess4545.com/team4545/register/',
                    availability:
                        'https://www.lichess4545.com/team4545/availability/edit/',
                    nominate: 'https://www.lichess4545.com/team4545/nominate/',
                    notifications:
                        'https://www.lichess4545.com/team4545/notifications/',
                },
            },
            lonewolf: {
                name: 'Lone Wolf',
                alsoKnownAs: [
                    'lonewolf',
                    '3030',
                    '30',
                    'lw',
                    'lonewolf',
                    'wolf',
                ],
                alternate: undefined,
                heltour: {
                    token: 'foo',
                    baseEndpoint: 'http://localhost:8000/api/',
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
                links: {
                    faq: 'https://www.lichess4545.com/lonewolf/document/faq/',
                    rules: 'https://www.lichess4545.com/lonewolf/document/rules/',
                    league: 'https://www.lichess4545.com/lonewolf/',
                    pairings: 'https://www.lichess4545.com/lonewolf/pairings/',
                    standings:
                        'https://www.lichess4545.com/lonewolf/standings/',
                    guide: '',
                    captains: '',
                    registration:
                        'https://www.lichess45454.com/lonewolf/register/',
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
                    token: 'foo',
                    baseEndpoint: 'http://localhost:8000/api/',
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
                    pairings:
                        'https://www.lichess4545.com/blitzbattle/pairings/',
                    standings:
                        'https://www.lichess4545.com/blitzbattle/standings/',
                    guide: '',
                    captains: '',
                    registration:
                        'https://www.lichess45454.com/blitzbattle/register/',
                    availability:
                        'https://www.lichess4545.com/blitzbattle/availability/edit/',
                    nominate:
                        'https://www.lichess4545.com/blitzbattle/nominate/',
                    notifications:
                        'https://www.lichess4545.com/blitzbattle/notifications/',
                },
            },
            chess960: {
                name: 'Lichess 960',
                alsoKnownAs: ['960', '1515'],
                alternate: undefined,
                heltour: {
                    token: 'foo',
                    baseEndpoint: 'http://localhost:8000/api/',
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
                links: {
                    faq: 'https://www.lichess4545.com/chess960/document/faq/',
                    rules: 'https://www.lichess4545.com/chess960/document/rules/',
                    league: 'https://www.lichess4545.com/chess960/',
                    pairings: 'https://www.lichess4545.com/chess960/pairings/',
                    standings:
                        'https://www.lichess4545.com/chess960/standings/',
                    guide: '',
                    captains: '',
                    registration:
                        'https://www.lichess45454.com/chess960/register/',
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
        pingMods: {},
    }
    describe('config parsing', () => {
        it('Test full config decoder', () => {
            ChessterConfigDecoder.decodeJSON(JSON.stringify(config))
            assert(true)
            assert(config.leagues['45+45'].scheduling.extrema.isoWeekday == 1)
            assert(config.leagues['45+45'].scheduling.extrema.hour == 11)
            assert(config.leagues['45+45'].scheduling.extrema.warningHours == 1)
        })
    })
})
