//------------------------------------------------------------------------------
// Commands for onboarding new folks
//------------------------------------------------------------------------------
const _ = require("lodash");

function welcomeMessage(config) {
    return function(bot, message) {
        if(_.isEqual(message.channel, bot.channels.getId(config["welcome"]["channel"]))){
            bot.reply(message, "Everyone, please welcome the newest member of the " 
                             + "Lichess 45+45 League, <@" + message.user + ">!");

            bot.startPrivateConversation(message.user).then(function(convo){
               convo.say("Welcome. I am the moderator bot for the Lichess4545 league");
               convo.say("Say 'help' to get help."); 
               convo.say("If you joined for the 45+45 league, read this: " 
                   + config["leagues"]["45+45"].links.faq 
                   + ". If you joined for Lone Wolf, read this: " 
                   + config["leagues"]["lonewolf"].links.faq 
                   + ". Enjoy the league!"); 
            });
        }
    };
}

module.exports.welcomeMessage = welcomeMessage;
