const _ = require("lodash");
const winston = require("winston");

function addChallenge(config, logic){
    return function(bot, message){
        if (_.indexOf(config["mod-channel"], message.channel) > -1){
	    var words = message.text.split(" ");
	    if (words.length !== 5){
                bot.reply(message, "usage: @chesster add challenge <challenger> <defender> <white>");
            } else {
		logic.addChallenge(words[2], words[3], words[4]);
                bot.reply(message, "done");
            }
	}
    };
}

function addGame(config, logic){
    return function(bot, message){
        if (_.indexOf(config["mod-channel"], message.channel) > -1){
	    var words = message.text.split(" ");
	    if (words.length !== 7){
                bot.reply(message, "usage: @chesster add game <white> <black> <challenger> <link> <result>");
            } else {
		logic.addGame(words[2], words[3], words[4], words[5], words[6]);
                bot.reply(message, "done");
            }
	}
    };
}

function findChallenge(config, logic){
    return function(bot, message){
        if (_.indexOf(config["mod-channel"], message.channel) > -1){
	    var words = message.text.split(" ");
	    if (words.length !== 4){
                bot.reply(message, "usage: @chesster find challenge <player> <player>");
            } else {
		var challenge = logic.findChallenge(words[2], words[3], function(challenge){
                    if (challenge && challenge.challenger && challenge.challengee){
                        bot.reply(message, challenge.challenger + " challenged " + challenge.challengee);
                    } else {
		        bot.reply(message, "No such challenge found");
                    }
		});
            }
	}
    };
}

module.exports.addChallenge = addChallenge;
module.exports.addGame = addGame;
module.exports.findChallenge = findChallenge;