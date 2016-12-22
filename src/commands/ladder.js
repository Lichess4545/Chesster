const _ = require("lodash");

function addChallenge(config, logic){
    return function(bot, message){
        if (_.isEqual(message.channel, config["mod-channel"])){
	    var words = message.text.split(" ");
	    if (words.length !== 5){
                bot.reply(message, "usage: @chesster add challenge <challenger> <defender> <white>");
            } else {
		logic.addChallenge(words[2], words[3], words[4]);
            }
	}
    };
}

function addGame(config, logic){
    return function(bot, message){
        if (_.isEqual(message.channel, config["mod-channel"])){
	    var words = message.text.split(" ");
	    if (words.length !== 7){
                bot.reply(message, "usage: @chesster add game <white> <black> <challenger> <link> <result>");
            } else {
		logic.addGame(words[2], words[3], words[4], words[5], words[6]);
            }
	}
    };
}

module.exports.addChallenge = addChallenge;
module.exports.addGame = addGame;