// -----------------------------------------------------------------------------
// Entry point for Chesster
// Bot commands are defined here with implementations in various modules.
// -----------------------------------------------------------------------------
import winston from 'winston'
import * as slack from './slack'
import Watcher from './watcher'
import { getAllLeagues } from './league'

import * as availability from './commands/availability'
import * as games from './commands/games'
import * as leagueInfo from './commands/leagueInfo'
import * as messageForwarding from './commands/messageForwarding'
import * as privateURLs from './commands/privateURLs'
import * as onboarding from './commands/onboarding'
import * as playerInfo from './commands/playerInfo'
import * as scheduling from './commands/scheduling'
import * as subscription from './commands/subscription'
import * as presence from './commands/presence'
import * as lichess from './lichess'

/* static entry point */

const configFile = process.argv[2] || '../config/config.js'
const chesster = new slack.SlackBot('lichess4545', configFile)

if (process.env.NODE_ENV !== 'production') {
    winston.add(
        new winston.transports.Console({
            format: winston.format.simple(),
        })
    )
}

const adminSlack = new slack.SlackBot(
    'chesster',
    configFile,
    false,
    false,
    false,
    true
)

// A helper for a very common pattern
export function directRequiresLeague(
    patterns: RegExp[],
    callback: slack.LeagueCommandCallbackFn
) {
    chesster.hears({
        type: 'league_command',
        patterns,
        messageTypes: ['direct_message', 'direct_mention'],
        callback,
    })
}

// league information
directRequiresLeague(
    [/captain guidelines/],
    leagueInfo.directResponse((l) => l.formatCaptainGuidelinesResponse())
)
directRequiresLeague(
    [/captains/, /captain list/],
    leagueInfo.dmResponse((l) => l.formatCaptainsResponse())
)
directRequiresLeague(
    [/faq/],
    leagueInfo.directResponse((l) => l.formatFAQResponse())
)
directRequiresLeague(
    [/notify mods/, /summon mods/],
    leagueInfo.directResponse((l) => l.formatSummonModsResponse())
)
directRequiresLeague(
    [/^mods/, /^moderators/],
    leagueInfo.directResponse((l) => l.formatModsResponse())
)
directRequiresLeague(
    [/pairings/],
    leagueInfo.directResponse((l) => l.formatPairingsLinkResponse())
)
directRequiresLeague(
    [/rules/, /regulations/],
    leagueInfo.directResponse((l) => l.formatRulesLinkResponse())
)
directRequiresLeague(
    [/standings/],
    leagueInfo.directResponse((l) => l.formatStandingsLinkResponse())
)
directRequiresLeague(
    [/welcome$/, /starter guide/, /player handbook/],
    leagueInfo.directResponse((l) => l.formatStarterGuideResponse())
)

// availability
chesster.hears({
    type: 'league_command',
    patterns: [/available/, /unavailable/],
    messageTypes: ['direct_message', 'direct_mention'],
    callback: availability.updateAvailability,
})

// alternate assignment
chesster.hears({
    type: 'league_command',
    patterns: [/^assign/],
    messageTypes: ['ambient', 'direct_mention'],
    callback: availability.assignAlternate,
})

// alternate unassignment
chesster.hears({
    type: 'league_command',
    patterns: [/^unassign/],
    messageTypes: ['ambient', 'direct_mention'],
    callback: availability.unassignAlternate,
})

// Message Forwarding
adminSlack.hears({
    type: 'command',
    patterns: [/^forward to/],
    messageTypes: ['direct_mention', 'bot_message'],
    callback: messageForwarding.forwardMessage(chesster, adminSlack),
})
adminSlack.hears({
    type: 'command',
    patterns: [/^refresh/],
    messageTypes: ['direct_mention', 'bot_message'],
    callback: messageForwarding.refreshLeague(chesster, adminSlack),
})

// private urls
chesster.hears({
    type: 'league_command',
    patterns: [/get nomination url/, /nomination/],
    messageTypes: ['direct_message'],
    callback: privateURLs.nomination,
})
chesster.hears({
    type: 'league_command',
    patterns: [/get notification url/, /notification/],
    messageTypes: ['direct_message'],
    callback: privateURLs.notification,
})
chesster.hears({
    type: 'league_command',
    patterns: [/availability/, /edit availability/, /availability edit/],
    messageTypes: ['direct_message'],
    callback: privateURLs.availability,
})
chesster.hears({
    type: 'league_command',
    patterns: [/link/],
    messageTypes: ['direct_message'],
    callback: privateURLs.linkAccounts,
})

// rating
chesster.hears({
    type: 'command',
    patterns: [slack.appendPlayerRegex('rating', true)],
    messageTypes: ['direct_mention', 'direct_message'],
    callback: playerInfo.playerRating,
})

chesster.hears({
    type: 'command',
    patterns: [slack.appendPlayerRegex('pairing', true)],
    messageTypes: ['direct_mention', 'direct_message'],
    callback: playerInfo.playerPairings,
})

// commands

function prepareCommandsMessage() {
    return (
        'I will respond to the following commands when they are spoken to ' +
        chesster.users.getIdString('chesster') +
        ': \n```' +
        '    [ starter guide ]              ! get the starter guide link; thanks GnarlyGoat!\n' +
        '    [ rules | regulations ]        ! get the rules and regulations.\n' +
        '    [ pairing | pairing <player> ] ! get your (or given <player>) latest pairings with scheduled time\n' +
        '    [ pairings ]                   ! get pairings link\n' +
        '    [ standings ]                  ! get standings link\n' +
        '    [ commands | \n' +
        '        command list ]             ! this list\n' +
        "    [ rating <player> ]            ! get the player's classical rating.\n" +
        '    [ captain guidelines ]         ! get the team captain guidelines\n' +
        '    [ mods (lonewolf)| \n' +
        '        mod list (lonewolf)|       ! list the mods (without summoning)\n' +
        '        mods summon (lonewolf)]    ! summon the mods\n' +
        '    [ faq (lonewolf)]                        ! a document of frequently asked questions\n' +
        '    [ registration | sign up ]     ! registration form to play in our league\n' +
        '    [ nomination (4545) ]          ! get a nomination link for up to 3 games.\n' +
        '    [ source ]                     ! github repo for Chesster \n' +
        "    [ subscription help ]          ! help for chesster's subscription system\n" +
        '    [ link ]                       ! link your slack and lichess accounts\n' +
        '```\n'
    )
}

chesster.hears({
    type: 'command',
    patterns: [/^commands/, /^command list/, /^help$/],
    messageTypes: ['direct_mention', 'direct_message'],
    callback: async (bot: slack.SlackBot, message: slack.CommandMessage) => {
        const convo = await bot.startPrivateConversation([message.user])
        bot.say({
            channel: convo.channel.id,
            text: prepareCommandsMessage(),
        })
    },
})

// welcome

chesster.on({
    event: 'member_joined_channel',
    callback: onboarding.welcomeMessage,
})

chesster.hears({
    type: 'command',
    middleware: [slack.requiresModerator],
    patterns: [/^welcome me/],
    messageTypes: ['direct_mention'],
    callback: onboarding.welcomeMessage,
})

// source

chesster.hears({
    type: 'command',
    patterns: [/source/],
    messageTypes: ['direct_message', 'direct_mention'],
    callback: (bot, message) =>
        bot.reply(message, chesster.config.links.source),
})

// Scheduling

// Scheduling will occur on any message
chesster.hears({
    type: 'league_command',
    patterns: [/.*/],
    messageTypes: ['ambient'],
    callback: scheduling.ambientScheduling,
})

// results parsing

// results processing will occur on any message
chesster.hears({
    type: 'league_command',
    patterns: [/.*/],
    messageTypes: ['ambient'],
    callback: games.ambientResults,
})

// game link parsing

// gamelink processing will occur on any message
chesster.hears({
    type: 'league_command',
    patterns: [/.*http.*/],
    messageTypes: ['ambient'],
    callback: games.ambientGamelinks,
})
chesster.hears({
    type: 'command',
    patterns: [/^subscription help$/, /^unsubscribe$/],
    messageTypes: ['direct_message'],
    callback: subscription.helpHandler,
})

chesster.hears({
    type: 'command',
    patterns: [/^subscription list$/],
    messageTypes: ['direct_message'],
    callback: subscription.listHandler,
})

chesster.hears({
    type: 'command',
    patterns: [/^subscribe teams$/],
    messageTypes: ['direct_message'],
    callback: subscription.subscribeTeams,
})

// subscriptions

chesster.hears({
    type: 'command',
    patterns: [/^tell/],
    messageTypes: ['direct_message'],
    callback: subscription.tellMeWhenHandler,
})

chesster.hears({
    type: 'command',
    patterns: [/^subscription remove (\d+)$/],
    messageTypes: ['direct_message'],
    callback: subscription.removeHandler,
})

subscription.register(
    chesster,
    'a-game-is-scheduled',
    subscription.formatAGameIsScheduled
)
subscription.register(chesster, 'a-game-starts', subscription.formatAGameStarts)
subscription.register(
    chesster,
    'a-game-is-over',
    subscription.formatAGameIsOver
)

chesster.hears({
    type: 'command',
    patterns: [/.*/],
    messageTypes: ['ambient'],
    callback: presence.ambientPresence,
})

chesster.start()
adminSlack.start()

// -----------------------------------------------------------------------------
// Start the watcher.
const watcher = new Watcher(chesster, getAllLeagues(chesster))
watcher.watch()

lichess.startQueue()
