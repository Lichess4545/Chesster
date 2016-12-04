// extlibs
var moment = require('moment-timezone');
var Q = require("q");
var _ = require("lodash");
var winston = require("winston");

// Our stuff
var heltour = require('./heltour.js');
var http = require("./http.js");
var league = require("./league.js");
var lichess = require('./lichess.js');
var slack = require('./slack.js');
var subscription = require('./subscription.js');
var commands = require('./commands.js');
const watcher = require('./watcher.js');
const games = require('./commands/games.js');
const availability = require("./commands/availability.js");
const nomination = require("./commands/nomination.js");
const scheduling = require("./commands/scheduling.js");
const leagueInfo = require("./commands/leagueInfo.js");
const playerInfo = require("./commands/playerInfo.js");

var users = slack.users;
var channels = slack.channels;

var SWORDS = '\u2694';

/* static entry point */

var config_file = process.argv[2] || "../config/config.js"; 
var chesster = new slack.Bot({
    config_file: config_file
});

if (!('toJSON' in Error.prototype)) {
    Object.defineProperty(Error.prototype, 'toJSON', {
        value: function () {
            var alt = {};

            Object.getOwnPropertyNames(this).forEach(function (key) {
                alt[key] = this[key];
            }, this);

            return alt;
        },
        configurable: true,
        writable: true
    });
}

function handleHeltourErrors(bot, message, error){
    if (_.isEqual(error, "no_matching_rounds")) {
        replyNoActiveRound(bot, message);
    } else if (_.isEqual(error, "no_pairing")) {
        resultReplyMissingPairing(bot, message);
    } else if (_.isEqual(error, "ambiguous")) {
        resultReplyTooManyPairings(bot, message);
    } else {
        replyGenericFailure(bot, message, "@endrawes0");
        throw new Error("Error making your update: " + error);
    }
}

// A helper for a very common pattern
function directRequiresLeague(patterns, callback) {
    chesster.hears(
        {
            middleware: [slack.requiresLeague],
            patterns: patterns,
            messageTypes: [
                'direct_message',
                'direct_mention'
            ]
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
    ['welcome', 'starter guide', 'player handbook'],
    leagueInfo.directResponse('formatStarterGuideResponse')
);


/* availability */
chesster.hears(
    {
        middleware: [ slack.withLeague ],
        patterns: [ 'available', 'unavailable' ],
        messageTypes: [ 'direct_message', 'direct_mention' ]
    },
    availability.updateAvailability
);



/* alternate assignment */
chesster.hears(
    {
        middleware: [ slack.withLeagueByChannelName ],
        patterns: [ '^assign' ],
        messageTypes: [ 
            'ambient'
        ]
    }, 
    availability.assignAlternate
);

/* alternate unassignment */
chesster.hears(
    {
        middleware: [ slack.withLeagueByChannelName ],
        patterns: [ '^unassign' ],
        messageTypes: [ 
            'ambient'
        ]
    }, 
    availability.unassignAlternate
);

/* game nomination */
chesster.hears(
    {
        middleware: [ slack.requiresLeague ],
        patterns: [ 'nomination' ],
        messageTypes: [ 'direct_message' ]
    },
    nomination.nomination
)

/* rating */

chesster.hears(
    {
        patterns: [slack.appendPlayerRegex("rating", true)],
        messageTypes: [
            'direct_mention', 
            'direct_message'
        ]
    },
    playerInfo.playerRating
);

chesster.hears(
    {
        patterns: [
            slack.appendPlayerRegex("pairing", true)
        ],
        messageTypes: [
            'direct_mention', 'direct_message'
        ]
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
/*        "    [ challenge <opp1> <opp2> <w|b|r> <tc-min>+<tc-inc> <[un]rated> ]" +
        "                                   ! this command will create a <rated|casual> challenge between\n" +
        "                                   ! two opponents <opp1> <opp2> \n" +
        "                                   ! opponent one being colored <w|b|r> and \n" +
        "                                   ! time control <tc-min> with a <tc-inc> increment \n" +*/
        "    [ teams | \n" +
        "        team list |                ! list the teams in the current tournament\n" +
        "        team stats <team-name> |   ! get statistics for a given <team-name>\n" +
        "        team members <team-name> | ! list the members of a given <team-name>\n" +
        "        team captain <team-name> ] ! name the captain of a given <team-name>\n" +
        "    [ captains | \n" +
        "        captain list |             ! list the team captains\n" +
        "        captain guidelines ]       ! get the team captain guidelines\n" +
        "    [ board <number> ]             ! get a sorted list of players by board\n" +
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
    patterns: [
        'commands', 
        'command list',
        '^help$'
    ],
    messageTypes: [
        'direct_mention', 
        'direct_message'
    ]
},
function(bot,message) {
    bot.startPrivateConversation(message, function (response, convo) {
        convo.say(prepareCommandsMessage());
    });
});


/* welcome */

chesster.on({event: 'user_channel_join'},
function(bot, message) {
    if(_.isEqual(message.channel, channels.getId(chesster.config["welcome"]["channel"]))){
        bot.reply(message, "Everyone, please welcome the newest member of the " 
                         + "Lichess 45+45 League, <@" + message.user + ">!");

        bot.startPrivateConversation(message, function(err, convo){
           convo.say("Welcome. I am the moderator bot for the Lichess4545 league");
           convo.say("Say 'help' to get help."); 
           convo.say("If you joined for the 45+45 league, read this: " 
               + chesster.config["leagues"]["45+45"].links.faq 
               + ". If you joined for Lone Wolf, read this: " 
               + chesster.config["leagues"]["lonewolf"].links.faq 
               + ". Enjoy the league!"); 
        });
    }
});


/* source */

chesster.hears({
    patterns: "source",
    messageTypes: [
        'direct_message',
        'direct_mention'
    ]
},
function(bot, message){
    bot.reply(message, chesster.config.links.source);
});


// There is not active round
function replyNoActiveRound(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " There is currently no active round. If this is a mistake, contact a mod");
}

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

chesster.hears({
    middleware: [],
    patterns: ['^tell'],
    messageTypes: ['direct_message']
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        subscription.processTellCommand(chesster.config, message).then(function(response) {
            convo.say(response);
            deferred.resolve();
        }).catch(function(error) {
            convo.say("I'm sorry, but an error occurred processing this subscription command");
            deferred.reject(error);
        });
    });
    return deferred.promise;
});

chesster.hears({
    middleware: [],
    patterns: ['^subscription help$', '^unsubscribe$'],
    messageTypes: ['direct_message']
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        subscription.formatHelpResponse(chesster.config).then(function(response) {
            convo.say(response);
            deferred.resolve();
        }).catch(function(error) {
            convo.say("I'm sorry, but an error occurred processing this subscription command");
            deferred.reject(error);
        });
    });
    return deferred.promise;
});

chesster.hears({
    middleware: [],
    patterns: ['^subscription list$'],
    messageTypes: ['direct_message']
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        subscription.processSubscriptionListCommand(chesster.config, message).then(function(response) {
            convo.say(response);
            deferred.resolve();
        }).catch(function(error) {
            convo.say("I'm sorry, but an error occurred processing this subscription command");
            deferred.reject(error);
        });
    });
    return deferred.promise;
});

chesster.hears({
    middleware: [],
    patterns: [/^subscription remove (\d+)$/],
    messageTypes: ['direct_message']
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        subscription.processSubscriptionRemoveCommand(chesster.config, message, message.match[1]).then(function(response) {
            convo.say(response);
            deferred.resolve();
        }).catch(function(error) {
            convo.say("I'm sorry, but an error occurred processing this subscription command");
            deferred.reject(error);
        });
    });
    return deferred.promise;
});

subscription.register(chesster, 'a-game-is-scheduled', function(target, context) {
    // TODO: put these date formats somewhere, probably config?
    var friendlyFormat = "ddd @ HH:mm";
    target = slack.getSlackUserFromNameOrID(target);
    var targetDate = context.result.date.clone().utcOffset(target.tz_offset/60);
    context['yourDate'] = targetDate.format(friendlyFormat);
    var fullFormat = "YYYY-MM-DD @ HH:mm UTC";
    context['realDate'] = context.result.date.format(fullFormat);
    return "{white.name} vs {black.name} in {leagueName} has been scheduled for {realDate}, which is {yourDate} for you.".format(context);
});


subscription.register(chesster, 'a-game-starts', function (target, context) {
    return "{white.name} vs {black.name} in {leagueName} has started: {result.gamelink}".format(context);
});

subscription.register(chesster, 'a-game-is-over', function(target, context) {
    return "{white.name} vs {black.name} in {leagueName} is over. The result is {result.result}.".format(context);
});


//------------------------------------------------------------------------------
// Start the watcher.
watcher.watchAllLeagues(chesster);
