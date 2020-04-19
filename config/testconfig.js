// NOTE: Neither of these files are committed and for good reason.
//       You must provide your own.
var token = require('./slack_token.js').token
try {
    var test_chesster_slack_token = require('./test_chesster_slack_token.js')
        .token
} catch (e) {
    var test_chesster_slack_token = null
}
var heltour_token = require('./test_heltour_token.js').token

const UNSTABLE_BOT_ID = 'C0VCCPMJ8'
const UNSTABLE_BOT_LONEWOLF_ID = 'C0XQM31SL'

var config = require('./config.js')
config['watcherBaseURL'] = 'https://lichess.dev/api/stream/games-by-users'
config['slackTokens']['chesster'] = test_chesster_slack_token
config['winston']['channel'] = '#modster-logging'
config['winston']['handleExceptions'] = false

config['welcome']['channel'] = 'dev-testing-lonewolf'

config['heltour']['token'] = heltour_token
config['heltour']['baseEndpoint'] = 'http://localhost:8000/api/'
config['leagues']['45+45']['heltour']['token'] = heltour_token
config['leagues']['45+45']['heltour']['baseEndpoint'] =
    'http://localhost:8000/api/'
config['leagues']['lonewolf']['heltour']['token'] = heltour_token
config['leagues']['lonewolf']['heltour']['baseEndpoint'] =
    'http://localhost:8000/api/'

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

config['messageForwarding']['channel'] = 'N/A'

module.exports = config
