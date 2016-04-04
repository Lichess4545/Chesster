var async = require("async");
var Botkit = require('botkit');
var GoogleSpreadsheet = require("google-spreadsheet");
var fs = require('fs');
var levenshtein = require('fast-levenshtein');

var SHEET_URL = "https://lichess4545.slack.com/files/mrlegilimens/F0VNACY64/lichess4545season3-graphs";
var RULES_URL = "https://lichess4545.slack.com/files/parrotz/F0D7RD88L/lichess4545leaguerulesregulations";
var STARTER_URL = "https://lichess4545.slack.com/files/endrawes0/F0W382170/lichess4545leagueplayerguide";
var CAPTAINS_URL = "https://lichess4545.slack.com/files/endrawes0/F0V3SPE90/guidelinesforlichess4545teamcaptains2.doc";
var REGISTRATION_URL = "https://docs.google.com/a/georgetown.edu/forms/d/1u-fjOm1Mouz8J7WAsPhB1CJpB3k10FSp4-fZ-bwvykY/viewform";
var GITHUB_URL = "https://github.com/endrawes0/Chesster";

var TEAM_NAME = 1;
var TEAM_START_ROW = 2;
var TEAM_END_ROW = 27;
var BOARD_1_NAME = 2;
var BOARD_1_RATING = 4;
var BOARD_2_NAME = 5;
var BOARD_2_RATING= 7;
var BOARD_3_NAME = 8;
var BOARD_3_RATING = 10;
var BOARD_4_NAME = 11;
var BOARD_4_RATING = 13;
var BOARD_5_NAME = 14;
var BOARD_5_RATING = 16;
var BOARD_6_NAME = 17;
var BOARD_6_RATING = 19;

var LONEWOLF_CHANNEL_NAMES = [
    "lonewolf-general",
    "lonewolf-gamelinks",
    "lonewolf-schedule",
    "lonewolf-results"
];
var TEAM_CHANNEL_NAMES = [
    "general",
    "team-gamelinks",
    "team-schedule",
    "team-results"
];
var LONEWOLF_TARGETS = LONEWOLF_CHANNEL_NAMES.concat([
    "lonewolf",
    "lone",
    "wolf",
    "lw",
    "30",
    "3030",
]);
var TEAM_TARGETS = TEAM_CHANNEL_NAMES.concat([
    "team",
    "45",
    "4545",
]);

if (!process.env.token) {
  console.log('Error: Specify token in environment');
  process.exit(1);
}

var controller = Botkit.slackbot({
    debug: false
});

var users = {
    getId: function(name){
        return this[name].id;
    },
    getIdString: function(name){
        return "<@"+this.getId(name)+">";
    }
};
var channels = {
    getId: function(name){
        return this[name].id;
    },
    getIdString: function(name){
        return "<#"+this.getId(name)+">";
    }
};
var channelsByID = { };


var fuzzy_match = function (search_string, targets) {
    if (!targets) { return null; } // TODO: not sure this is the right choice ...
    var results = [];
    targets.forEach(function(item) {
        var distance = levenshtein.get(search_string, item);
        results.push([distance, item]);
    });
    results.sort(function(a,b) {
        return a[0] - b[0];
    });
    var choices = [];
    var min_distance = results[0][0];
    results.forEach(function(item) {
        var distance = item[0];
        var match = item[1];
        if (distance == min_distance) {
            choices.push(match);
        }
    });

    return choices;
}
var get_command_and_targets = function(message, commands, arg_string) {
    var command = commands[0];
    var target = "general";
    var channel = channelsByID[message.channel];
    if (channel && channel.name) {
        target = channel;
    }
    var args = arg_string;
    if (args) {
        args = args.split(" ");
        if (args.length > 2) {
            console.log("too many arguments to determine target / or command: ", arg_string);
            return {
                command: null,
                target: null
            };
        }
        args.forEach(function(item) {
            var found = false;
            commands.forEach(function(c) {
                if (found) { return; }
                if (levenshtein.get(c, item) < c.length / 2) {
                    found = true;
                    command = item;
                }
            });
            if (!found) {
                target = item;
            }
        });
    }
    command = fuzzy_match(command, commands);
    target = fuzzy_match(target, LONEWOLF_TARGETS.concat(TEAM_TARGETS));
    if (command.length > 1) {
        console.log("Ambiguous command: ", command, target);
        return {
            command: null,
            target: null
        };
    }
    command = command[0];
    var team_votes = 0;
    var wolf_votes = 0;
    target.forEach(function(item) {
        var is_team = TEAM_TARGETS.indexOf(item) > -1;
        var is_lonewolf = LONEWOLF_TARGETS.indexOf(item) > -1;
        if (is_team) team_votes++;
        if (is_lonewolf) wolf_votes++;

    });
    var retval = {
        command: command,
        target: null,
    };
    if (team_votes == wolf_votes) {
        console.log("Ambiguous target!");
    } else if (team_votes > wolf_votes) {
        retval.target = "team";
    } else if (wolf_votes > team_votes) {
        retval.target = "lonewolf";
    }
    return retval;
}

controller.spawn({
  token: process.env.token
}).startRTM(function(err, bot) {
    // @ https://api.slack.com/methods/users.list
    bot.api.users.list({}, function (err, response) {
        if (response.hasOwnProperty('members') && response.ok) {
            var total = response.members.length;
            for (var i = 0; i < total; i++) {
                var member = response.members[i];
                users[member.name] = member;
            }
        }
        console.log("info: got users");
    });

    // @ https://api.slack.com/methods/channels.list
    bot.api.channels.list({}, function (err, response) {
        if (response.hasOwnProperty('channels') && response.ok) {
            var total = response.channels.length;
            for (var i = 0; i < total; i++) {
                var channel = response.channels[i];
                channels[channel.name] = channel;
                channelsByID[channel.id] = channel;
            }
        }
        console.log("info: got channels");
    });
    if (err) {
        throw new Error(err);
    }
});

/* stop giritime */

controller.hears([
	'giritime'
],[
	'ambient'
],function(bot,message) {
    exception_handler(bot, message, function(){
        var response = "Stop... Giri Time!\n" + "Hi! Im Chesster. Ill be your new bot. " + 
						"To interact with me, mention " + users.getIdString("chesster") + 
						" in a message";
        bot.reply(message, response);
    });
});

/* captains */

function prepareCaptainsGuidelines(){
    return "Here are the captain's guidelines:\n" + CAPTAINS_URL;
}

function sayCaptainsGuidelnes(convo){
    convo.say(prepareCaptainsGuidelines());
}

controller.hears([
    'captain guidelines'
], [
    'direct_mention',
    'direct_message'
], function(bot, message){
    exception_handler(bot, message, function(){
        bot.reply(message, prepareCaptainsGuidelines());
    });
});

controller.hears([
    'captains', 
    'captain list'
],[
    'direct_mention', 
    'direct_message'
],function(bot,message) {
    exception_handler(bot, message, function(){
        var self = this;
        loadSheet(self, function(){
            getTeams(self, function(){
                getCaptains(self, function(){
                    bot.reply(message, prepareCaptainsMessage(self.teams));
                });
            });
        });
    });
});

function getCaptains(self, callback){
    self.sheet.getCells({
        "min-row": TEAM_START_ROW,
        "max-row": TEAM_END_ROW,
        "min-col": BOARD_1_NAME, 
        "max-col": BOARD_6_NAME,
	"return-empty": true,
    }, function(err, cells) {
        var num_cells = cells.length;
        for(var ci in cells){
            var cell = cells[ci];
            var team_index = cell.row - TEAM_START_ROW; // number of rows before team name start
            switch(cell.col){
                case BOARD_1_NAME:
                case BOARD_2_NAME:
                case BOARD_3_NAME:
                case BOARD_4_NAME:
                case BOARD_5_NAME:
                case BOARD_6_NAME:
                if(cell.value.includes("*")){
                    if(!self.teams[team_index]){
                        self.teams[team_index] = {};
                    }
                    self.teams[team_index]["captain"] = cell.value.replace("*", "");
                }
                break;
            }
        }
        callback();
    });
}

function prepareCaptainsMessage(teams){
    var message = "Team Captains:\n";
    var teamIndex = 1;
    teams.forEach(function(team, index, array){
        message += "\t" + (teamIndex++) + ". " + team.name + ": " + (team.captain || "Unchosen") + "\n";
    });
    return message;
}

function sayCaptains(self, convo, callback){
    convo.say(prepareCaptainsMessage(self.teams));
    convo.next();
}

/* rating */

controller.hears([
	'rating'
],[
	'direct_mention', 
	'direct_message'
],function(bot,message) {
    exception_handler(bot, message, function(){
        var self = this;
        var player_name = message.text.split(" ").slice(1).join(" ");
        if(player_name && player_name != ""){
            getRating(player_name, function(rating){
                if(rating){
                    bot.reply(message, prepareRatingMessage(player_name, rating));
                }else{
                    bot.reply(message, "I am sorry. I could not find that player.");
                }
            });
        }else{
            bot.reply(message, "Rating of which player? [ " + users.getIdString("chesster") + 
								" rating <player> ]. Please try again.");
        }
    });
});

function getRating(player, callback){
    getPlayerByName(player, function(opponent){
        if(opponent){
            getClassicalRating(opponent, callback);
        }else{
            callback();
        }
    });
}

function sayRating(player, rating, convo){
    convo.say(prepareRatingMessage(player, rating));    
}

function prepareRatingMessage(player, rating, convo){
    return player + " is rated " + rating + " in classical chess";
}

/* commands */

function prepareCommandsMessage(){
    return "I will respond to the following commands when they are spoken to " + 
									  users.getIdString("chesster") + ": \n```" +
        "    [ help ]                       ! display an interactive guide\n" +
        "    [ starter guide ]              ! get the starter guide link; thanks GnarlyGoat!\n" +
        "    [ rules | regulations ]        ! get the rules and regulations.\n" + 
        "    [ pairings | standings ]       ! get pairings/standings spreadsheet link\n" +
        "    [ channels | \n" +
        "        channel list |             ! list the important channels\n" +
        "        channel detail <channel> ] ! details regarding #<channel>\n" +
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
        "    [ feedback <feedback>]         ! send @chesster some feedback (bug reports, \n" +
        "                                   ! suggestions, gratitude, etc)\n" +
        "    [ mods (lonewolf)| \n"  +
        "        mod list (lonewolf)|       ! list the mods (without summoning)\n" +
        "        mods summon (lonewolf)]    ! summon the mods\n" +
        "    [ faq ]                        ! a document of frequently asked questions\n" + 
        "    [ registration | sign up ]     ! registration form to play in our league\n" +
        "    [ changelog ]                  ! list a log of changes to Chesster \n" +
        "    [ source ]                     ! github repo for Chesster \n" +
        "```\n";
}

function sayCommands(convo){
    convo.say(prepareCommandsMessage());
}

controller.hears([
    'commands', 
	'command list'
],[
	'direct_mention', 
	'direct_message'
], function(bot,message) {
    exception_handler(bot, message, function(){
        bot.reply(message, prepareCommandsMessage());
    });
});

/* mods */

function prepareSummonModsMessage(){
    return "Summoning mods:" + 
		users.getIdString("endrawes0") + ", " + 
		users.getIdString("mkoga") + ", " +
		users.getIdString("mrlegilimens") + ", " +
		users.getIdString("petruchio") + ", " +
		users.getIdString("seb32") + ", " +
		users.getIdString("theino");
}

function prepareSummonLoneWolfModsMessage(){
    return "Summoning LoneWolf mods:" + 
		users.getIdString("endrawes0") + ", " + 
		users.getIdString("matuiss2") + ", " +
	users.getIdString("lakinwecker") + ", " +
		users.getIdString("theino");
}

function prepareModsMessage(){
    return "Mods: endrawes0, mkoga, mrlegilimens, petruchio, seb32, theino";
}

function prepareLoneWolfModsMessage(){
    return "LoneWolf mods: endrawes0, matuiss2, lakinwecker, theino";
}

function sayMods(convo){
    convo.say(prepareModsMessage());
}

function sayLoneWolfMods(convo){
    convo.say(prepareLoneWolfModsMessage);
}

controller.hears([
    "^mods$",
    "^mods (.*)$",
], [
    'direct_mention', 
    'direct_message'
], function(bot, message) {
    exception_handler(bot, message, function(){
        var results = get_command_and_targets(message, ["list", "summon"], message.match[1]);
        var command = results.command;
        var target = results.target;
        if (!target) {
            console.log("Error determining which tournament to target for mods command");
        } else if (target == "team") {
            if (command == "list") {
                bot.reply(message, prepareModsMessage());
            } else if (command == "summon") {
                bot.reply(message, prepareSummonModsMessage());
            }
        } else if (target == "lonewolf") {
            if (command == "list") {
                bot.reply(message, prepareLoneWolfModsMessage());
            } else if (command == "summon") {
                bot.reply(message, prepareSummonLoneWolfModsMessage());
            }
        } else {
            console.log("Unable to determine target");
        }
    });
});

/* help */

controller.hears(['help'],['direct_mention', 'direct_message'],function(bot,message) {
    exception_handler(bot, message, function(){
        bot.startPrivateConversation(message, howMayIHelpYou);
    });
});

function askAboutHelp(convo, more){
    convo.ask("How " + (more ? "else" : "") + " may I help you? \n" +
        "\tI'm new here... [ starter guide ] \n" +
        "\tI want to see [ pairings ] or [ standings ]. \n" +
        "\tI want to see the [ rules ] and [ regulations ]. \n" +
        "\tWho are the [ mods ]? \n" +
        "\tWhat [ teams ] are competing? \n" +
        "\tWhat [ channels ] should I join?\n" +
        "\tWhat [ commands ] do you respond to?\n" +
        "\tI have a question... [faq]\n" +
        "\tHow do I [ sign up ] to play?\n" +
        "\tNothing further. I am [ done ].\n" +
        "Note: all options work as 'standalone' commands. Try: [@chesster <command>] from outside the help dialog.", 
        function(response, convo) {
            responses[response.text] ? responses[response.text](convo) : responses["default"](convo);
        }
    );
    convo.next();
}

function howMayIHelpYou(response, convo) {
    askAboutHelp(convo);
};

var responses = {
    "starter guide": function(convo){
        sayStarterGuide(convo);
        askAboutHelp(convo, true);
    },
    "pairings": function(convo){
        sayPairings(convo);
        askAboutHelp(convo, true);
    },
    "standings": function(convo){
        sayStandings(convo);
        askAboutHelp(convo, true);
    },
    "mods": function(convo){
        convo.say("The mods are ");
        askAboutHelp(convo, true);
    },
    "faq": function(convo){
        convo.say("https://docs.google.com/document/d/11c_c711YRsOKw9XrEUgJ8-fBYDAmCpSkLytwcxlmn-A");
        askAboutHelp(convo, true);
    },
    "sign up": function(convo){
        sayRegistrationMessage(convo);
        askAboutHelp(convo, true);
    },
    "teams": function(convo){
        var self = this;
        loadSheet(self, function(){
            getTeams(self, function(){
                sayTeams(self, convo);
                askAboutHelp(convo, true);
            });
        });
    },
    "commands": function(convo){
        sayCommands(convo);
        askAboutHelp(convo, true);
    },
    "channels": function(convo){
        sayChannels(convo);
        askAboutHelp(convo, true);
    },
    "done": function(convo){
        sayGoodbye(convo);
    },
    "default": function(convo){
        convo.say("I am sorry. I didnt understand.");
        askAboutHelp(convo);
    }
}

/* channels */
function prepareChannelListMessage(){
    return "You may find the following channels useful:\n" +
        "\t" + channels.getIdString("general") + "\n" +
        "\t" + channels.getIdString("team-scheduling") + "\n" +
        "\t" + channels.getIdString("team-gamelinks") + "\n" +
        "\t" + channels.getIdString("team-results") + "\n" +
        "\t" + channels.getIdString("team-scheduling") + "\n" +
        "\t" + channels.getIdString("team-gamelinks") + "\n" +
        "\t" + channels.getIdString("team-results") + "\n" +
        "\t" + channels.getIdString("random") + "\n" +
        "Try: [ @chesster channel details <channel name> ] for more detail.";
}

function sayChannels(convo){
    convo.say(prepareChannelListMessage());
}

function prepareChannelDetailMessage(channel){
    var CHANNEL_DETAILS = {
        "general": channels.getIdString("general") + " is used to communicate news to members of " + 
			"the league. Any general league discussion can be done there. If conversation is not " +
			"league related, please go to " + channels.getIdString("random") + 
			" or create a new channel.",
        "team-scheduling": "Put the time of your scheduled games here." + 
			"\n\tFormat: \"@white v @black, mm/dd @ HH:MM\" (all times GMT)",
        "team-gamelinks": "Post links to lichess, league games here.",
        "team-results": "Post results here."
			+ "\n\tFormat: \"@white v @black, <result>\", where <result> in {1-0, 1/2-1/2, 0-1}",
        "random": "Anything can be discussed here. " + 
			"And if it is not league related, it belongs in here.",
        "default": "I am sorry. I do not recognize that channel.",
    };

    channel = channel.replace("#", ""); //remove channel special character
    return CHANNEL_DETAILS[channel] || CHANNEL_DETAILS["default"] + ": " + channel;
}

function sayChannelDetail(convo, channel){
    convo.say(prepareChannelDetailMessage(channel));
}

controller.hears([
	'channels', 
	'channel list'
],[
	'direct_mention', 
	'direct_message'
],function(bot, message) {
    exception_handler(bot, message, function(){
        var self = this;
        bot.reply(message, prepareChannelListMessage());
    });
});

controller.hears([
	'channel detail'
],[
	'direct_mention'
],function(bot, message) {
    exception_handler(bot, message, function(){
        var channel_name = message.text.split(" ").slice(2).join(" ");
        bot.reply(message, prepareChannelDetailMessage(channel_name));
    });
});


/* pairings */

function preparePairingsMessage(){
    return "Here is the pairings sheet:\n" + 
            SHEET_URL + 
            "\nAlternatively, try [ @chesster pairing <competitor> <round> ] - coming soon...";
}

function sayPairings(convo){
    convo.say(preparePairingsMessage());
}

controller.hears([
    'pairings'
],[
    'direct_mention', 
    'direct_message'
],function(bot, message) {
    exception_handler(bot, message, function(){
        bot.reply(message, preparePairingsMessage());
    });
});

/* standings */

function prepareStandingsMessage(){
    return "Here is the standings sheet:\n" + 
            SHEET_URL + 
            "\nAlternatively, try [ @chesster result <competitor> <round> ] - coming soon...";
    
}

function sayStandings(convo){
    convo.say(prepareStandingsMessage());
}

controller.hears([
    'standings'
],[
    'direct_mention', 
    'direct_message'
],function(bot, message) {
    exception_handler(bot, message, function(){
        bot.reply(message, prepareStandingsMessage());
    });
});

/* rules */

function prepareRulesMessage(){
    return "Here are the rules and regulations:\n" + RULES_URL;
}

function sayRules(convo){
    convo.say(prepareRulesMessage());
}

controller.hears([
    'rules',
    'regulations'
], [
    'direct_message',
    'direct_mention'
], function (bot, message){
    exception_handler(bot, message, function(){
        bot.reply(message, prepareRulesMessage());
    });
});
/* done */

function sayGoodbye(convo){
    convo.say("Glad to help. Bye!");
    convo.next();
}

/* sheets */

function loadSheet(self, callback){
    var doc = new GoogleSpreadsheet('1FJZursRrWBmV7o3xQd_JzYEoB310ZJA79r8fGQUL1S4');
    doc.getInfo(function(err, info) {
        self.sheet = info.worksheets[4];                    
        callback();
    });
}

/* exceptions */

controller.hears([
	"exception handle test"
], [
	"ambient"
], function(bot, message){
    exception_handler(bot, message, function(){
        throw new Error("an error");
    });
});

function exception_handler(bot, message, todo){
    try{
        todo();
    }catch(e){
        var error_log = "An error occurred:" + 
            "\nDatetime: " + new Date() + 
            "\nMessage: " +  JSON.stringify(message) + 
            "\nError: " + JSON.stringify(e) + 
            "\nStack: " + e.stack +
            "\n\n";
        console.log(error_log);
        fs.appendFile("./errors_log", error_log, function(err) {
            if(err) {
                console.log("failed to write to the file...")
                console.log(e);
                return console.log(err);
            }            
        }); 
        bot.reply(message, "Something has gone terribly terribly wrong. Please forgive me.");
    }
}

/* teams */

function getTeams(self, callback){
    self.teams = [];
    self.sheet.getCells({
        "min-row": TEAM_START_ROW,
        "min-col": TEAM_NAME, 
        "max-col": TEAM_NAME,
        "return-empty": true,
    }, function(err, cells) {
        var num_cells = cells.length;
        for(var ci = 0; ci < num_cells; ++ci){
            if(cells[ci].value == ""){
                break;
            }
            self.teams.push({
               name: cells[ci].value
            });
        }
        callback();
    });
}

function sayTeams(self, convo){
    convo.say(prepareTeamsMessage(self));
}

function prepareTeamsMessage(self){
    var message = "There are currently " + self.teams.length + " teams competing. \n";
    var teamIndex = 1;
    self.teams.forEach(function(team, index, array){
        message += "\t" + (teamIndex++) + ". " + team.name + "\n";
    });
    return message;
}

function prepareTeamCaptainMessage(team){
    if(team && team.captain){
    	return "Captain of " + team.name + " is " + team.captain;
    }else{
        return team.name + " has not chosen a team captain. ";
    }
}

controller.hears([
	'team captain'
], [
	'direct_mention', 
	'direct_message'
], function(bot, message) {
    exception_handler(bot, message, function(){
        var self = this;
        var team_name = message.text.split(" ").slice(2).join(" ");
        loadSheet(self, function(){
            getTeams(self, function(){
                getCaptains(self, function(){
                    for(var ti in self.teams){
                        var team = self.teams[ti];
                        if(team.name == team_name){
                            bot.reply(message, prepareTeamCaptainMessage(team));
                            break;
                        }
                    }
                });
            });
        });
    });
});

controller.hears([
	'teams', 
	'team list'
],[
	'direct_mention', 
	'direct_message'
], function(bot,message) {
    exception_handler(bot, message, function(){
        var self = this;
        loadSheet(self, function(){
            getTeams(self, function(){
                bot.reply(message, prepareTeamsMessage(self));
            });
        });
    });
});

/* team members */

function createOrGetMember(memberList, i){
    if(!memberList[i]){
        memberList[i] = {};
    }
    return memberList[i];
}

function getMembers(self, callback){
    self.members = [];
    self.sheet.getCells({
        "min-row": TEAM_START_ROW,
        "min-col": TEAM_NAME, 
        "max-col": BOARD_6_NAME,
    }, function(err, cells) {
        var num_cells = cells.length;
        var team_row = -1;
        for(var ci = 0; ci < num_cells; ++ci){
            var cell = cells[ci];
            if(cell.col == TEAM_NAME){
                if(cell.value == self.team_name){
                    team_row = cell.row;
                    break;
                }
            }
        }
        for(var ci = 0; ci < num_cells; ++ci){
            var cell = cells[ci];
            if(cell.row == team_row){
                var name = cell.value.replace("*", "");
                console.log(name);
                switch(cell.col){
                    case BOARD_1_NAME:
                    createOrGetMember(self.members, 0)["name"] = name;
                    break;
                    case BOARD_2_NAME:
                    createOrGetMember(self.members, 1)["name"] = name;
                    break;
                    case BOARD_3_NAME:
                    createOrGetMember(self.members, 2)["name"] = name;
                    break;
                    case BOARD_4_NAME:
                    createOrGetMember(self.members, 3)["name"] = name;
                    break;
                    case BOARD_5_NAME:
                    createOrGetMember(self.members, 4)["name"] = name;
                    break;
                    case BOARD_6_NAME:
                    createOrGetMember(self.members, 5)["name"] = name;
                    break;
                }
            }
        }
        callback();
    });
}

function prepareMembersResponse(self){
    var message = "The members of " + self.team_name + " are \n";
    self.members.forEach(function(member, index, array){
        message += "\tBoard " + (index+1) + ": " + member.name + " (" + member.rating + ")\n";
    });
    return message;
}

function playerRatingAsyncJob(team_member){
    return function(callback){
        getPlayerByName(team_member.name, function(player){
            if(player){
                getClassicalRating(player, function(rating){
                    team_member.rating = rating;
                    callback();
                });
            }else{
                callback("failed to get player: " + team_member.name);
            }
        });
    };
}

controller.hears([
	'team members'
],[
	'direct_mention', 
	'direct_message'
], function(bot, message) {
    exception_handler(bot, message, function(){
        var self = this;
        self.team_name = message.text.split(" ").slice(2).join(" ");
        if(self.team_name && self.team_name != ""){
	    loadSheet(self, function(){
	        getMembers(self, function(){
	            async.series([
	                playerRatingAsyncJob(self.members[0]),
                        playerRatingAsyncJob(self.members[1]),
                        playerRatingAsyncJob(self.members[2]),
                        playerRatingAsyncJob(self.members[3]),
                        playerRatingAsyncJob(self.members[4]),
                        playerRatingAsyncJob(self.members[5]),
                    ], function(err){
                       if(!err){
                           bot.reply(message, prepareMembersResponse(self));
                       }else{
                           bot.reply(message, err);
                       }
                    });
                });
            });
        }else{
            bot.reply(message, "Which team did you say? [ team members <team-name> ]. Please try again.");
        }
    });
});

/* LICHESS STUFF */

function getPlayerByName(name, callback){
    const http = require('http');
    var url = "http://en.lichess.org/api/user/" + name;
    http.get(url, (res) => {
        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', () => {
            if(body != ""){
                console.log('BODY: ' + body);
                callback(JSON.parse(body));
            }else{
                callback();
            }
        });
    }).on('error', (e) => {
        console.log(e);
        callback()
    });
}

function getClassicalRating(opp, callback){
  callback(opp.perfs.classical.rating);
}

/* welcome */

controller.on('user_channel_join', function(bot, message) {
    exception_handler(bot, message, function(){
        if(message.channel == channels.getId("general")){
            bot.reply(message, "Everyone, please welcome the newest member of the " 
                             + "Lichess 45+45 League, <@" + message.user + ">!");
            
            bot.startPrivateConversation(message, function(err, convo){
                convo.say("Hi <@" + message.user + ">, \n" 
                        + "\tIt seems you are new here. " 
                        + "We are happy to have you join the Lichess 45+45 League.\n"
                        + "\tMy name is Chesster. I am a bot. " 
                        + "I was created to help moderate the league. " 
                        + "It is my job to welcome you and to share with you " 
                        + "some resources with which you should familiarize yourself.\n" 
                        + "\tPlease read our Starter Guide and Rules documents. " 
                        + "They will give you a better idea how this league works.\n" 
                        + "\tIf you have not already, I suggest downloading the Slack App: " 
                        + "https://slack.com/downloads so you can stay " 
                        + "connected with the league. It is the easiest way for most "
                        + "of us to communicate and you will find that many of us "
                        + "are active in this community every day. Make yourself at home.");
                convo.say(STARTER_URL);
                convo.say(RULES_URL);
                convo.say("\tIf there is anything else I can help you with, do not hesitate to ask. " 
                        + "You can send me a direct message in this private channel. " 
                        + "Just say `commands` to see a list of ways that I can help you.\n" 
                        + "\tIf there is ANYTHING else, dont hesitate to reach out to the moderators. " 
                        + "We love to help out. Say `mods` to get a list.");
            });
        }
    });
});

function prepareStarterGuideMessage(){
    return "Here is everything you need to know... ";
}

function sayStarterGuide(convo){
    convo.say(prepareStarterGuideMessage());
    convo.say(STARTER_URL);
}

controller.hears([
	'welcome', 
	'starter guide', 
	'player handbook'
], [
	'direct_mention', 
	'direct_message'
], function(bot,message) {
    exception_handler(bot, message, function(){
        bot.reply(message, prepareStarterGuideMessage());
        bot.reply(message, STARTER_URL);
    });
});

/* feedback */

controller.hears([
	"feedback"
], [
	"direct_mention"
], function(bot, message){
    exception_handler(bot, message, function(){
        bot.reply(message, "As a computer, I am not great at understanding tone. Whether this was positive, negative, constructive or deconstructive feedback, I cannot tell. But regardless, I am quite glad you took the time to leave it for me. \n\nWith love and admiration,\nChesster.");
        var feedback_log = "Receieved new feedback:" + 
                           "\nMessage: " + JSON.stringify(message) + "\n\n";
       fs.appendFile("./feedback_log", feedback_log, function(err) {
            if(err) {
                console.log("failed to write to the file...")
                console.log(feedback_log);
                console.log(err);
                throw new Error("Failed to log feedback: " + feedback_log);
            }
        });
    });
});

controller.hears([
	'thanks'
], [
	'direct_mention', 
	'mention', 
	'direct_message'
], function(bot,message) {
    exception_handler(bot, message, function(){
        bot.reply(message, "It is my pleasure to serve you!");
    });
});

/* registration */

function sayRegistrationMessage(convo){
    convo.say(prepareRegistrationMessage());
}

function prepareRegistrationMessage(){
    return "You can sign up for Season 3 here: " + REGISTRATION_URL;
}

controller.hears([
    "registration",
    "register",
    "sign up"
], [
    'direct_message',
    'direct_mention'
], function(bot, message){
    exception_handler(bot, message, function(){
        bot.reply(message, prepareRegistrationMessage());
    });
});

/* challenges */

//http --form POST en.l.org/setup/friend?user=usernameOrId variant=1 clock=false time=60 increment=60 color=random 'Accept:application/vnd.lichess.v1+json'

controller.hears([
	'challenge'
], [
	'direct_mention', 
	'direct_message'
], function(bot,message) {
    exception_handler(bot, message, function(){
    });
});

/* changelog */

controller.hears([
    "changelog",
], [
    'direct_message',
    'direct_mention'
], function(bot, message){
    exception_handler(bot, message, function(){
        fs.readFile("./changelog", 'utf8', function(err, data) {
            if(err) {
                throw err;
            }else{
                bot.reply(message, data);
            }
        });
    });
});

/* source */

controller.hears([
    "source",
], [
    'direct_message',
    'direct_mention'
], function(bot, message){
    exception_handler(bot, message, function(){
        bot.reply(message, GITHUB_URL);
    });
});

/* board */

function getBoard(self, callback){
    self.players = [];
    var board_name = BOARD_1_NAME + ((self.board_number - 1) * 3);
    var board_rating = BOARD_1_RATING + ((self.board_number - 1) * 3);
    self.sheet.getCells({
        "min-row": TEAM_START_ROW,
        "max-row": TEAM_END_ROW, 
        "min-col": TEAM_NAME,
        "max-col": board_rating,
    }, function(err, cells) {
        var num_cells = cells.length;
        for(var ci = 0; ci < num_cells; ++ci){
            var cell = cells[ci];
            var team_number = cell.row - TEAM_START_ROW;
            var player = createOrGetMember(self.players, team_number);
            switch(cell.col){
                case TEAM_NAME:
                    player.team = cell.value;
                case board_name: 
                    player.name = cell.value.replace("*", "");    
                case board_rating:
                    player.rating = cell.value;
            }
        }
        callback();
    });
}

function prepareBoardResponse(self){
    var message = "Board " + self.board_number + " consists of... \n";
    self.players.sort(function(e1, e2){
        return e1.rating > e2.rating ? -1 : e1.rating < e2.rating ? 1 : 0;
    });
    self.players.forEach(function(member, index, array){
        message += "\t" + member.name + ": (Rating: " + member.rating + "; Team: " + member.team + ")\n";
    });
    return message;
}

controller.hears([
	'board'
],[
	'direct_mention', 
	'direct_message'
], function(bot, message) {
    exception_handler(bot, message, function(){
        var self = this;
        self.board_number = parseInt(message.text.split(" ")[1]);
        if(self.board_number && !isNaN(self.board_number)){
	    loadSheet(self, function(){
	        getBoard(self, function(){
                    bot.reply(message, prepareBoardResponse(self));
                });
            });
        }else{
            bot.reply(message, "Which board did you say? [ board <number> ]. Please try again.");
        }
    });
});
