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

                    var text = "Welcome. I am the league moderator bot.\n"
                               + "*Before you can participate, you must <{}|click here to link your Slack and Lichess accounts.>*\n".format(result.url)
                               + "After that, read the FAQ for your league: "
                               + "<{}|4545 League FAQ> | <{}|LoneWolf FAQ>\n".format(config["leagues"]["45+45"].links.faq, config["leagues"]["lonewolf"].links.faq)
                               + "Say 'help' to get help. Enjoy the league!";

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
