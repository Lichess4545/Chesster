//------------------------------------------------------------------------------
// Entry point for Chesster
// Bot commands are defined here with implementations in various modules. 
//------------------------------------------------------------------------------
const slack = require('./slack.js');
const errors = require('./errors.js');
errors.init();
const watcher = require('./watcher.js');

var users = slack.users;

/* static entry point */

var config_file = process.argv[2] || "../config/config.js"; 
var chesster = new slack.Bot({
    config_file: config_file
});

const games = require('./commands/games.js')(chesster, slack);
const availability = require("./commands/availability.js")(chesster, slack);
const nomination = require("./commands/nomination.js")(chesster, slack);
const scheduling = require("./commands/scheduling.js")(chesster, slack);
const leagueInfo = require("./commands/leagueInfo.js")(chesster, slack);
const onboarding = require("./commands/onboarding.js")(chesster, slack);
const playerInfo = require("./commands/playerInfo.js")(chesster, slack);
const subscription = require('./commands/subscription.js')(chesster, slack);

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

//------------------------------------------------------------------------------
// Start the watcher.
watcher.watchAllLeagues(chesster);
