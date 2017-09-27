//------------------------------------------------------------------------------
// Commands for onboarding new folks
//------------------------------------------------------------------------------
const _ = require("lodash");
const heltour = require('../heltour.js');

function welcomeMessage(config) {
    return function(bot, message) {
        if(_.isEqual(message.channel, bot.channels.getId(config["welcome"]["channel"]))){
            heltour.linkSlack(config.heltour, message.user, "").then(function(result) {
                bot.reply(message, "Everyone, please welcome the newest member of the " 
                                 + "Lichess 45+45 League, <@" + message.user + ">!");
                
                bot.api.im.open({ user: message.user }, function(err, channel) {
                    if (err) return;
        
                    var channelId = channel.channel.id;

                    var text = "Welcome. I am the moderator bot for the Lichess4545 League.\n"
                               + "Say 'help' to get help.\n"
                               + "Before you can participate, you need to link your Slack and Lichess accounts.\n"
                               + "<{}|Click here> to do that now.\n".format(result.url)
                               + "If you joined for the 45+45 league, read this: " 
                               + config["leagues"]["45+45"].links.faq 
                               + ". If you joined for Lone Wolf, read this: " 
                               + config["leagues"]["lonewolf"].links.faq 
                               + ". Enjoy the league!";

                    bot.say({
                        channel: channelId,
                        text: text,
                        attachments: []
                    });
                });
            });
        }
    };
}

module.exports.welcomeMessage = welcomeMessage;
