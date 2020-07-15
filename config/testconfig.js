// NOTE: Neither of these files are committed and for good reason.
//       You must provide your own.
let test_chesster_slack_token = "";
try {
    test_chesster_slack_token = require('./test_chesster_slack_token.js')
        .token
} catch (e) {
}
let heltour_token = require('./test_heltour_token.js').token

const UNSTABLE_BOT_ID = 'C0VCCPMJ8'
const UNSTABLE_BOT_LONEWOLF_ID = 'C0XQM31SL'

let config = require('./config.js')
config['watcherBaseURL'] = 'https://lichess.dev/api/stream/games-by-users'
config['slackTokens']['chesster'] = test_chesster_slack_token
config['winston']['channel'] = '#modster-logging'
config['winston']['handleExceptions'] = false

config['welcome']['channel'] = 'dev-testing-lonewolf'

let heltour = {
    baseEndpoint: 'http://localhost:8000/api/',
    token: heltour_token,
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
