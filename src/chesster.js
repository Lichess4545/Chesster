//------------------------------------------------------------------------------
// Entry point for Chesster
// Bot commands are defined here with implementations in various modules. 
//------------------------------------------------------------------------------
const slack = require('./slack.js');
const errors = require('./errors.js');
errors.init();
const watcher = require('./watcher.js');
const games = require('./commands/games.js');
const availability = require("./commands/availability.js");
const nomination = require("./commands/nomination.js");
const scheduling = require("./commands/scheduling.js");
const leagueInfo = require("./commands/leagueInfo.js");
const onboarding = require("./commands/onboarding.js");
const playerInfo = require("./commands/playerInfo.js");
const subscription = require('./commands/subscription.js');

var users = slack.users;

/* static entry point */

var config_file = process.argv[2] || "../config/config.js"; 
var chesster = new slack.Bot({
    config_file: config_file
});

// A helper for a very common pattern
function directRequiresLeague(patterns, callback) {
    chesster.hears(
        {
            middleware: [slack.requiresLeague],
            patterns: patterns,
            messageTypes: ['direct_message', 'direct_mention']
        },
        callback
    );
}

/* league information */
directRequiresLeague(
    ['captain guidelines'],
    leagueInfo.directResponse('formatCaptainGuidelinesResponse')
);
directRequiresLeague(
    ['captains', 'captain list'],
    leagueInfo.dmResponse('formatCaptainsResponse')
);
directRequiresLeague(
    ["faq"],
    leagueInfo.directResponse('formatFAQResponse')
);
directRequiresLeague(
    ['notify mods', 'summon mods'],
    leagueInfo.directResponse('formatSummonModsResponse')
);
directRequiresLeague(
    ['^mods$', '^moderators$'],
    leagueInfo.directResponse('formatModsResponse')
);
directRequiresLeague(
    ['pairings'],
    leagueInfo.directResponse('formatPairingsLinkResponse')
);
directRequiresLeague(
    ['rules', 'regulations'],
    leagueInfo.directResponse('formatRulesLinkResponse')
);
directRequiresLeague(
    ['standings'],
    leagueInfo.directResponse('formatStandingsLinkResponse')
);
directRequiresLeague(
    ['^welcome$', 'starter guide', 'player handbook'],
    leagueInfo.directResponse('formatStarterGuideResponse')
);

/* availability */
chesster.hears(
    {
        middleware: [slack.withLeague],
        patterns: ['available', 'unavailable'],
        messageTypes: ['direct_message', 'direct_mention']
    },
    availability.updateAvailability
);

/* alternate assignment */
chesster.hears(
    {
        middleware: [slack.withLeagueByChannelName],
        patterns: ['^assign'],
        messageTypes: ['ambient']
    }, 
    availability.assignAlternate
);

/* alternate unassignment */
chesster.hears(
    {
        middleware: [slack.withLeagueByChannelName],
        patterns: ['^unassign'],
        messageTypes: ['ambient']
    }, 
    availability.unassignAlternate
);

/* game nomination */
chesster.hears(
    {
        middleware: [slack.requiresLeague],
        patterns: ['nomination'],
        messageTypes: ['direct_message']
    },
    nomination.nomination
);

/* rating */

chesster.hears(
    {
        patterns: [slack.appendPlayerRegex("rating", true)],
        messageTypes: ['direct_mention', 'direct_message']
    },
    playerInfo.playerRating
);

chesster.hears(
    {
        patterns: [
            slack.appendPlayerRegex("pairing", true)
        ],
        messageTypes: ['direct_mention', 'direct_message']
    },
    playerInfo.playerPairings(chesster.config)
);

/* commands */

function prepareCommandsMessage(){
    return "I will respond to the following commands when they are spoken to " + 
									  users.getIdString("chesster") + ": \n```" +
        "    [ starter guide ]              ! get the starter guide link; thanks GnarlyGoat!\n" +
        "    [ rules | regulations ]        ! get the rules and regulations.\n" + 
        "    [ pairing | pairing <player> ] ! get your (or given <player>) latest pairings with scheduled time\n" +
        "    [ pairings ]                   ! get pairings link\n" +
        "    [ standings ]                  ! get standings link\n" +
        "    [ commands | \n"  +
        "        command list ]             ! this list\n" +
        "    [ rating <player> ]            ! get the player's classical rating.\n" +
        "    [ captain guidelines ]         ! get the team captain guidelines\n" +
        "    [ mods (lonewolf)| \n"  +
        "        mod list (lonewolf)|       ! list the mods (without summoning)\n" +
        "        mods summon (lonewolf)]    ! summon the mods\n" +
        "    [ faq (lonewolf)]                        ! a document of frequently asked questions\n" + 
        "    [ registration | sign up ]     ! registration form to play in our league\n" +
        "    [ source ]                     ! github repo for Chesster \n" +
        "    [ subscription help ]          ! help for chesster's subscription system\n" +
        "    [ nomination <league> ]        ! get a private nomination link for <league>, {45|lonewolf}, of your choosing\n" +
        "```\n";
}

chesster.hears({
    patterns: ['commands', 'command list', '^help$'],
    messageTypes: ['direct_mention', 'direct_message']
},
function(bot,message) {
    bot.startPrivateConversation(message, function (response, convo) {
        convo.say(prepareCommandsMessage());
    });
});


/* welcome */

chesster.on({event: 'user_channel_join'}, onboarding.welcomeMessage(chesster.config));
chesster.hears(
    {
        middleware: [slack.requiresLeague, slack.requiresModerator],
        patterns: ['^welcome me'],
        messageTypes: ['direct_mention']
    },
    onboarding.welcomeMessage(chesster.config)
);

/* source */

chesster.hears(
    {
        patterns: "source",
        messageTypes: ['direct_message', 'direct_mention']
    },
    function(bot, message){
        bot.reply(message, chesster.config.links.source);
    }
);

/* Scheduling */


// Scheduling will occur on any message
chesster.on(
    {
        event: 'ambient',
        middleware: [slack.withLeagueByChannelName]
    },
    scheduling.ambientScheduling
);

/* results parsing */

// results processing will occur on any message
chesster.on(
    {
        event: 'ambient',
        middleware: [slack.withLeagueByChannelName]
    },
    games.ambientResults
);

/* game link parsing */

// gamelink processing will occur on any message
chesster.on(
    {
        event: 'ambient',
        middleware: [slack.withLeagueByChannelName]
    },
    games.ambientGamelinks
);

/* subscriptions */

chesster.hears(
    {
        patterns: ['^tell'],
        messageTypes: ['direct_message']
    },
    subscription.tellMeWhenHandler(chesster.config)
);

chesster.hears(
    {
        patterns: ['^subscription help$', '^unsubscribe$'],
        messageTypes: ['direct_message']
    },
    subscription.helpHandler(chesster.config)
);

chesster.hears(
    {
        patterns: ['^subscription list$'],
        messageTypes: ['direct_message']
    },
    subscription.listHandler(chesster.config)
);

chesster.hears(
    {
        patterns: [/^subscription remove (\d+)$/],
        messageTypes: ['direct_message']
    },
    subscription.removeHandler(chesster.config)
);

subscription.register(chesster, 'a-game-is-scheduled', subscription.formatAGameIsScheduled);
subscription.register(chesster, 'a-game-starts', subscription.formatAGameStarts);
subscription.register(chesster, 'a-game-is-over', subscription.formatAGameIsOver);

//------------------------------------------------------------------------------
// Start the watcher.
watcher.watchAllLeagues(chesster);
