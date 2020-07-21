// NOTE: Neither of these files are committed and for good reason.
//       You must provide your own.
const dotenv = require('dotenv')
dotenv.config()
let _4545_SLACK_TOKEN = process.env.CHESSTER_4545_SLACK_TOKEN
let CHESSTER_SLACK_TOKEN = process.env.CHESSTER_CHESSTER_SLACK_TOKEN
let HELTOUR_TOKEN = process.env.CHESSTER_HELTOUR_TOKEN

const UNSTABLE_BOT_ID = 'C016G6T5QTW'
const UNSTABLE_BOT_LONEWOLF_ID = 'C015V92UJUX'

let config = require('./config.js')
config['watcherBaseURL'] = 'https://lichess.dev/api/stream/games-by-users'
config['slackTokens']['lichess4545'] = _4545_SLACK_TOKEN
config['slackTokens']['chesster'] = CHESSTER_SLACK_TOKEN
config['winston']['channel'] = '#modster-logging'
config['winston']['handleExceptions'] = false

config['welcome']['channel'] = 'dev-testing-lonewolf'

let heltour = {
    baseEndpoint: 'http://localhost:8000/api/',
    token: HELTOUR_TOKEN,
}
let leagues = ['45+45', 'lonewolf', 'blitzbattle', 'chess960']
config['heltour'] = heltour
leagues.map((k) => {
    config['leagues'][k]['heltour'] = {
        ...heltour,
        leagueTag: config['leagues'][k]['heltour']['leagueTag'],
    }
})

config['leagues']['45+45']['scheduling']['channel'] = 'dev-testing'
config['leagues']['45+45']['results']['channel'] = 'dev-testing'
config['leagues']['45+45']['results']['channelId'] = UNSTABLE_BOT_ID
config['leagues']['45+45']['gamelinks']['channel'] = 'dev-testing'
config['leagues']['45+45']['gamelinks']['channelId'] = UNSTABLE_BOT_ID
config['leagues']['45+45']['alternate']['channelId'] = UNSTABLE_BOT_ID
config['leagues']['lonewolf']['scheduling']['channel'] = 'dev-testing-lonewolf'
config['leagues']['lonewolf']['results']['channel'] = 'dev-testing-lonewolf'
config['leagues']['lonewolf']['results']['channelId'] = UNSTABLE_BOT_LONEWOLF_ID
config['leagues']['lonewolf']['gamelinks']['channel'] = 'dev-testing-lonewolf'
config['leagues']['lonewolf']['gamelinks'][
    'channelId'
] = UNSTABLE_BOT_LONEWOLF_ID

config['channelMap'][UNSTABLE_BOT_ID] = '45+45'
config['channelMap']['dev-testing'] = '45+45'
config['channelMap']['dev-testing-lonewolf'] = 'lonewolf'
config['channelMap']['dev-testing-blitz'] = 'blitz'
config['channelMap'][UNSTABLE_BOT_LONEWOLF_ID] = 'lonewolf'

config['messageForwarding']['channelId'] = 'G3FJXJ0C9'

module.exports = config
