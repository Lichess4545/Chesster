// NOTE: Neither of these files are committed and for good reason.
//       You must provide your own.
const UNSTABLE_BOT_ID = 'C016G6T5QTW'
const UNSTABLE_BOT_LONEWOLF_ID = 'C08HXSVUH26'

const LONEWOLF_GAMES_CHANNEL_ID = 'C08JZJNU8UC'
const LONEWOLF_SCHEDULING_CHANNEL_ID = 'C08K6E8MJNM'

const CHESS960_GAMES_CHANNEL_ID = 'C08KHN4FTUY'
const CHESS960_SCHEDULING_CHANNEL_ID = 'C08JPSKRF2S'

// This is in the glbert-test slack
const TEAM_GAMES_CHANNEL_ID = 'C08HXSVUH26'

let config = require('./config.js')

config['watcherBaseURL'] = 'https://lichess.org/api/stream/games-by-users'
config['winston']['channel'] = '#modster-logging'
config['winston']['handleExceptions'] = false

config['welcome']['channel'] = 'dev-testing-lonewolf'

const heltourToken = config['heltour']['token']

let heltour = {
    baseEndpoint: 'http://localhost:8000/api/',
    token: config['heltour']['token'],
}
let leagues = ['45+45', 'lonewolf', 'blitzbattle', 'chess960']
config['heltour'] = heltour
leagues.map((k) => {
    config['leagues'][k]['heltour'] = {
        ...heltour,
        leagueTag: config['leagues'][k]['heltour']['leagueTag'],
    }
})

config['leagues']['45+45']['scheduling']['channel'] = 'team-scheduling'
// TODO events API: This was 'dev-testing' in the original config
config['leagues']['45+45']['results']['channel'] = 'team-games'
config['leagues']['45+45']['results']['channelId'] = TEAM_GAMES_CHANNEL_ID
// TODO events API: This was 'dev-testing' in the original config
config['leagues']['45+45']['gamelinks']['channel'] = 'team-games'
config['leagues']['45+45']['gamelinks']['channelId'] = TEAM_GAMES_CHANNEL_ID
config['leagues']['45+45']['alternate']['channelId'] = UNSTABLE_BOT_ID
config['leagues']['lonewolf']['scheduling']['channel'] = 'lonewolf-scheduling'
config['leagues']['lonewolf']['results']['channel'] = 'lonewolf-games'
config['leagues']['lonewolf']['results']['channelId'] =
    LONEWOLF_GAMES_CHANNEL_ID
config['leagues']['lonewolf']['gamelinks']['channel'] = 'lonewolf-games'
config['leagues']['lonewolf']['gamelinks']['channelId'] =
    LONEWOLF_GAMES_CHANNEL_ID
// Events API todo: I added this in becaue there was nothing for 960, not sure if it's needed
config['leagues']['chess960']['scheduling']['channel'] = 'chess960scheduling'
config['leagues']['chess960']['scheduling']['channelId'] =
    CHESS960_SCHEDULING_CHANNEL_ID
config['leagues']['chess960']['results']['channel'] = 'chess960games'
config['leagues']['chess960']['results']['channelId'] =
    CHESS960_GAMES_CHANNEL_ID
config['leagues']['chess960']['gamelinks']['channel'] = 'chess960games'

config['channelMap'][UNSTABLE_BOT_ID] = '45+45'
config['channelMap']['dev-testing'] = '45+45'
config['channelMap']['lonewolf-games'] = 'lonewolf'
config['channelMap']['dev-testing-blitz'] = 'blitz'
config['channelMap'][LONEWOLF_GAMES_CHANNEL_ID] = 'lonewolf'

config['messageForwarding']['channelId'] = 'C08HZL49YH0'
config['pingMods'] = {
    C016G6T5QTW: [
        // #dev-testing
        'U0164C6FXLK', // @lakinwecker
    ],
}

module.exports = config
