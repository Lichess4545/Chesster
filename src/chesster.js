// extlibs
var fs = require('fs');
var http = require('http');
var moment = require('moment');
var Q = require("q");
var _ = require("underscore");

// Our stuff
var fuzzy = require('./fuzzy_match.js');
var league = require("./league.js");
var player = require("./player.js");
var spreadsheets = require('./spreadsheets.js');
var slack = require('./slack.js');
var users = slack.users;
var channels = slack.channels;
var lichess = require('./lichess.js');
var subscription = require('./subscription.js');

/* exception handling */
/* later this will move it its own module */

function exception_handler(todo, on_error){
    try{
       todo();
    }catch(e){
        var error_log = "An error occurred:" +
            "\nDatetime: " + new Date() +
            "\nError: " + JSON.stringify(e) +
            "\nStack: " + e.stack;
        console.error(error_log);
        if (on_error) {
            on_error();
        }
    }
}

function bot_exception_handler(bot, message, todo){
    exception_handler(todo, function(){
        console.log("Message: " + JSON.stringify(message));
        bot.reply(message, "Something has gone terribly terribly wrong. Please forgive me.");
    });
}

function critical_path(todo){
    exception_handler(todo, function(){
        console.log("An exception was caught in a critical code-path. I am going down.");
        process.exit(1);
    });
}

/* static entry point */

var config_file = process.argv[2] || "../config/config.js"; 
var chesster = new slack.Bot({
    config_file: config_file
});

// A helper for a very common pattern
function leagueResponse(patterns, responseName) {
    chesster.hears({
        middleware: [slack.requiresLeague],
        patterns: patterns,
        messageTypes: [
            'direct_message',
            'direct_mention'
        ]
    },
    function (bot, message){
        return message.league[responseName]().then(function(response) {
            bot.reply(message, response);
        });
    });
}
// A helper for a very common pattern
function leagueDMResponse(patterns, responseName) {
    chesster.hears({
        middleware: [slack.requiresLeague],
        patterns: patterns,
        messageTypes: [
            'direct_message',
            'direct_mention'
        ]
    },
    function (bot, message){
        var deferred = Q.defer();
        bot.startPrivateConversation(message, function (response, convo) {
            message.league[responseName]().then(function(response) {
                convo.say(response);
                deferred.resolve();
            }, function(error) {
                deferred.reject(error);
            });
        });
        return deferred.promise;
    });
}

/* captains */
leagueResponse(['captain guidelines'], 'formatCaptainGuidelinesResponse');
leagueDMResponse(['captains', 'captain list'], 'formatCaptainsResponse');


/* rating */

chesster.hears({
    patterns: [player.appendPlayerRegex("rating", true)],
    messageTypes: [
        'direct_mention', 
        'direct_message'
    ]
},
function(bot,message) {
    var playerName = player.getSlackUser(users, message).name;
    return lichess.getPlayerRating(playerName).then(function(rating) {
        if(rating){
            bot.reply(message, prepareRatingMessage(playerName, rating));
        }else{
            bot.reply(message, "I am sorry. I could not find that player.");
        }
    });
});

function prepareRatingMessage(_player, rating, convo){
    return _player + " is rated " + rating + " in classical chess";
}

/* commands */

function prepareCommandsMessage(){
    return "I will respond to the following commands when they are spoken to " + 
									  users.getIdString("chesster") + ": \n```" +
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
        "    [ source ]                     ! github repo for Chesster \n" +
        "```\n";
}

chesster.hears({
    patterns: [
        'commands', 
        'command list',
        'help'
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

/* mods */

leagueResponse(['summon mods'], 'formatSummonModsResponse');
leagueResponse(['mods'], 'formatModsResponse');

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
        "default": "I am sorry. I do not recognize that channel."
    };

    channel = channel.replace("#", ""); //remove channel special character
    return CHANNEL_DETAILS[channel] || CHANNEL_DETAILS["default"] + ": " + channel;
}

chesster.controller.hears([
	'channels', 
	'channel list'
],[
	'direct_mention', 
	'direct_message'
],function(bot, message) {
    bot_exception_handler(bot, message, function(){
        var self = this;
        bot.reply(message, prepareChannelListMessage());
    });
});

chesster.controller.hears([
	'channel detail'
],[
	'direct_mention'
],function(bot, message) {
    bot_exception_handler(bot, message, function(){
        var channel_name = message.text.split(" ").slice(2).join(" ");
        bot.reply(message, prepareChannelDetailMessage(channel_name));
    });
});


/* pairings */
leagueResponse(['pairings', 'standings'], 'formatPairingsLinkResponse');

chesster.hears({
    patterns: [
        player.appendPlayerRegex("pairing", true)
    ],
    messageTypes: [
        'direct_mention', 'direct_message'
    ]
}, function(bot, message) {
    var targetPlayer = player.getSlackUser(users, message);
    var deferred = Q.defer();
    var allLeagues = league.getAllLeagues(chesster.config);
    bot.startPrivateConversation(message, function (response, convo) {
        Q.all(
            _.map(allLeagues, function(l) {
                return l.getPairingDetails(targetPlayer).then(function(details) {
                    if (details && details.opponent) {
                        return l.formatPairingResponse(message.player, details).then(function(response) {
                            convo.say(response);
                        });
                    } else {
                        convo.say("[" + l.options.name + "] Unable to find pairing for " + targetPlayer.name);
                    }
                }, function(error) {
                    console.error("error");
                    console.error(JSON.stringify(error));
                });
            })
        ).then(function(results) {
            deferred.resolve();
        }, function(error) {
            deferred.reject(error);
        });
    });
    return deferred.promise;
});

chesster.hears({
    middleware: [slack.requiresLeague, slack.requiresModerator],
    patterns: [
        'debug'
    ],
    messageTypes: [
        'direct_mention', 'direct_message'
    ]
}, function(bot, message) {
    return message.league.formatDebugResponse().then(function(reply) {
        bot.reply(message, reply);
    });
});

/* rules */
leagueResponse(['rules', 'regulations'], 'formatRulesLinkResponse');

/* exceptions */

chesster.hears({
    patterns: "exception handle test",
    messageTypes: [
        "ambient"
    ]
},
function(bot, message){
    throw new Error("an error");
});

/* teams */

chesster.hears({
    middleware: [slack.requiresLeague],
    patterns: 'team captain',
    messageTypes: [
        'direct_mention', 
        'direct_message'
    ]
},
function(bot, message) {
    var teamName = message.text.split(" ").slice(2).join(" ");
    return message.league.formatTeamCaptainResponse(teamName).then(function(response) {
        bot.reply(message, response);
    });
});

leagueResponse(['teams', 'team list'], 'formatTeamsResponse');


/* team members */
chesster.hears({
    middleware: [slack.requiresLeague],
    patterns: ['team members'],
    messageTypes: [
        'direct_mention', 
        'direct_message'
    ]
},
function(bot, message) {
    return Q.fcall(function() {
        var teamName = message.text.split(" ").slice(2).join(" ");
        if(teamName && !_.isEqual(teamName, "")){
            message.league.formatTeamMembersResponse(teamName).then(function(response) {
                bot.reply(message, response);
            });
        }else{
            bot.reply(message, "Which team did you say? [ team members <team-name> ]. Please try again.");
        }
    });
});

/* welcome */

chesster.on({event: 'user_channel_join'},
function(bot, message) {
    bot_exception_handler(bot, message, function(){
        if(_.isEqual(message.channel, channels.getId("general"))){
            bot.reply(message, "Everyone, please welcome the newest member of the " 
                             + "Lichess 45+45 League, <@" + message.user + ">!");
            
            bot.startPrivateConversation(message, function(err, convo){
                // TODO: the config links references below are hard coded
                //       to the 45+45 league. Eventually, we'll want to fix that
                //       but I'm not taking on that task right now.
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
                convo.say(chesster.config["leagues"]["45+45"].links.guide);
                convo.say(chesster.config["leagues"]["45+45"].links.rules);
                convo.say("\tIf there is anything else I can help you with, do not hesitate to ask. " 
                        + "You can send me a direct message in this private channel. " 
                        + "Just say `commands` to see a list of ways that I can help you.\n" 
                        + "\tIf there is ANYTHING else, dont hesitate to reach out to the moderators. " 
                        + "We love to help out. Say `mods` to get a list.");
            });
        }
    });
});

leagueResponse(['welcome', 'starter guide', 'player handbook'], 'formatStarterGuideResponse');

/* feedback */
chesster.hears({
    patterns: ['thanks', 'thank you'],
    messageTypes: [
        'direct_mention', 
        'mention', 
        'direct_message'
    ]
},
function(bot,message) {
    bot.reply(message, "It is my pleasure to serve you!");
});

/* registration */
leagueResponse(['registration', 'register', 'sign up', 'signup'], 'formatRegistrationResponse');


/* challenges */

//http --form POST en.l.org/setup/friend?user=usernameOrId variant=1 clock=false time=60 increment=60 color=random 'Accept:application/vnd.lichess.v1+json'

chesster.controller.hears([
	'challenge'
], [
	'direct_mention', 
	'direct_message'
], function(bot,message) {
    bot_exception_handler(bot, message, function(){
    });
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

/* board */

chesster.hears({
    middleware: [slack.requiresLeague],
    patterns: ['board'],
    messageTypes: [
        'direct_mention', 
        'direct_message'
    ]
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        boardNumber = parseInt(message.text.split(" ")[1], 10);
        if(boardNumber && !isNaN(boardNumber)){
            message.league.formatBoardResponse(boardNumber).then(function(response) {
                convo.say(response);
                deferred.resolve();
            });
        }else{
            convo.say("Which board did you say? [ board <number> ]. Please try again.");
            deferred.resolve();
        }
    });
    return deferred.promise;
});



/* Scheduling */

// Scheduling reply helpers

// Can't find the pairing
function schedulingReplyMissingPairing(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " I couldn't find your pairing. Please use a format like: @white v @black 04/16 @ 16:00");
}

// you are very close to the cutoff
function schedulingReplyTooCloseToCutoff(bot, message, schedulingOptions, white, black) {
    bot.reply(message, 
        ":heavy_exclamation_mark: @" + white.name + " @" + black.name + " " + schedulingOptions.warningMessage
    );
}

// Game has been scheduled.
function schedulingReplyScheduled(bot, message, results, white, black) {
    var whiteDate = results.date.clone().utcOffset(white.tz_offset/60);
    var blackDate = results.date.clone().utcOffset(black.tz_offset/60);
    var format = "YYYY-MM-DD @ HH:mm UTC";
    var friendly_format = "ddd @ HH:mm";
    var dates = [
        results.date.format(format) + " ",
        whiteDate.format(friendly_format) + " for " + white.name,
        blackDate.format(friendly_format) + " for " + black.name
    ];
    date_formats  = dates.join("\n\t");

    bot.reply(message, 
        ":heavy_check_mark: @" + white.name + " (_white pieces_) vs @" + black.name + " (_black pieces_) scheduled for: \n\t" + date_formats
    );
}


// Your game is out of bounds
function schedulingReplyTooLate(bot, message, schedulingOptions) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " " + schedulingOptions.lateMessage);
}

// can't find the users you menteiond
function schedulingReplyCantScheduleOthers(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " you may not schedule games for other people. You may only schedule your own games.");
}

// can't find the users you menteiond
function schedulingReplyCantFindUser(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " I don't recognize one of the players you mentioned.");
}

// Scheduling will occur on any message
chesster.on({
    event: 'ambient',
    middleware: [slack.withLeague]
},
function(bot, message) {
    if (!message.league) {
        return;
    }
    var channel = channels.byId[message.channel];
    if (!channel) {
        return;
    }
    var schedulingOptions = message.league.options.scheduling;
    if (!schedulingOptions) {
        console.error("{} league doesn't have scheduling options!?".format(message.league.options.name));
        return;
    } 
    var spreadsheetOptions = message.league.options.spreadsheet;
    if (!spreadsheetOptions) {
        console.error("{} league doesn't have spreadsheet options!?".format(message.league.options.name));
        return;
    } 
    if (!_.isEqual(channel.name, schedulingOptions.channel)) {
        return;
    }

    var isPotentialSchedule = false;
    var referencesSlackUsers = false;
    var hasPairing = false;

    var results = {
        white: '',
        black: ''
    };

    // Step 1. See if we can parse the dates
    try {
        results = spreadsheets.parseScheduling(message.text, schedulingOptions);
        isPotentialSchedule = true;
    } catch (e) {
        if (!(e instanceof (spreadsheets.ScheduleParsingError))) {
            throw e; // let others bubble up
        }
    }

    // Unless they included a date we can parse, ignore this message.
    if (!isPotentialSchedule) {
        return;
    }

    // Step 2. See if we have valid named players
    var white = users.getByNameOrID(results.white);
    var black = users.getByNameOrID(results.black);
    if (white && black) {
        results.white = white.name;
        results.black = black.name;
        referencesSlackUsers = true;
    }

    // Step 3. attempt to update the spreadsheet
    spreadsheets.updateSchedule(
        spreadsheetOptions,
        schedulingOptions,
        results,
        function(err, reversed) {
            if (err) {
                if (_.includes(err, "Unable to find pairing.")) {
                    hasPairing = false;
                } else {
                    bot.reply(message, "Something went wrong. Notify a mod");
                    throw new Error("Error updating scheduling sheet: " + err);
                }
            } else {
                hasPairing = true;
            }
            if (reversed) {
                var tmp = white;
                white = black;
                black = tmp;
            }

            if (!referencesSlackUsers) {
                schedulingReplyCantFindUser(bot, message);
                return;
            }
            var speaker = users.getByNameOrID(message.user);
            if (
                !_.isEqual(white.id, speaker.id) &&
                !_.isEqual(black.id, speaker.id) &&
                !message.player.isModerator()
            ) {
                schedulingReplyCantScheduleOthers(bot, message);
                return;
            }
            if (!hasPairing) {
                schedulingReplyMissingPairing(bot, message);
                return;
            }
            if (results.outOfBounds) {
                schedulingReplyTooLate(bot, message, schedulingOptions);
                return;
            }
            if (results.warn) {
                schedulingReplyTooCloseToCutoff(bot, message, schedulingOptions, white, black);
            }
            schedulingReplyScheduled(bot, message, results, white, black);
            subscription.emitter.emit('a-game-is-scheduled', bot, message, message.league, results, white, black);
        }
    );
});



/* results parsing */

// results processing will occur on any message
chesster.on({
    event: 'ambient',
    middleware: [slack.withLeague]
},
function(bot, message) {
    if (!message.league) {
        return;
    }
    var channel = channels.byId[message.channel];
    if (!channel) {
        return;
    }
    var spreadsheetOptions = message.league.options.spreadsheet;
    if (!spreadsheetOptions) {
        console.error("{} league doesn't have spreadsheet options!?".format(message.league.options.name));
        return;
    } 
    var resultsOptions = message.league.options.results;
    if (!resultsOptions || !_.isEqual(channel.name, resultsOptions.channel)) {
        return;
    }

    try{
        var result = spreadsheets.parseResult(message.text);
 
        if(!result.white || !result.black || !result.result){
            return;
        }

        result.white = users.getByNameOrID(result.white.replace(/[\<\@\>]/g, ''));
        result.black = users.getByNameOrID(result.black.replace(/[\<\@\>]/g, ''));
        
        if(
            !_.isEqual(result.white.id, message.user) &&
            !_.isEqual(result.black.id, message.user) &&
            !message.player.isModerator()
        ){
            replyPermissionFailure(bot, message);
            return;
        }

        //this could and probably should be improved at some point
        //this will require two requests to the spread sheet and
        //it can be done in one, but I am trying to reuse what 
        //I wrote before as simply as possibe for now

        //if a gamelink already exists, get it
        spreadsheets.fetchPairingGameLink(
            spreadsheetOptions,
            result,
            function(err, gamelink){
                //if a gamelink is found, use it to acquire details and process them
                if(!err && gamelink){
                    processGamelink(
                        bot, 
                        message, 
                        gamelink, 
                        message.league.options.gamelinks, 
                        result); //user specified result
                }else{
                    //update the spreadsheet with result only
                    spreadsheets.updateResult(
                        spreadsheetOptions,
                        result,
                        function(err, reversed){
                            if (err) {
                                if (_.includes(err, "Unable to find pairing.")) {
                                    resultReplyMissingPairing(bot, message);
                                } else {
                                    bot.reply(message, "Something went wrong. Notify @endrawes0");
                                    throw new Error("Error updating scheduling sheet: " + err);
                                }
                            } else {
                                resultReplyUpdated(bot, message, result);
                            }
                        }
                    );
                }
            }
        );

    }catch(e){
        //at the moment, we do not throw from inside the api - rethrow
        throw e;
    }
});

function replyPermissionFailure(bot, message){
    bot.reply(message, "Sorry, you do not have permission to update that pairing.");
}

function resultReplyMissingPairing(bot, message){
    bot.reply(message, "Sorry, I could not find that pairing.");
}

function resultReplyUpdated(bot, message, result){
    bot.reply(message, "Got it. @" + result.white.name + " " + result.result + " @" + result.black.name);
}



/* game link parsing */

//given a gamelinkID, use the lichess api to get the game details
//pass the details to the callback as a JSON object
function fetchGameDetails(gamelinkID, callback){
    fetchURLIntoJSON("http://en.lichess.org/api/game/" + gamelinkID, callback);
}

function fetchURLIntoJSON(url, callback){
    const http = require('http');
    http.get(url, (res) => {
        var body = "";
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', () => {
            if(!_.isEqual(body, "")){
                var json = JSON.parse(body);
                if(json){
                   callback(undefined, json);
                }else{
                   callback("body was not a valid JSON object");
                }
            }else{
                callback("body was empty from url: " + url);
            }
        });
    }).on('error', (e) => {
        console.error(JSON.stringify(e));
        callback("failed to get a response from url: " + url);
    });
}

//verify the game meets the specified parameters in options
function validateGameDetails(details, options){
    var result = {
        valid: true,
        reason: ""
    };
    if(!_.isEqual(details.rated, options.rated)){
        //the game is not rated correctly
        result.valid = false;
        result.reason = "the game is " + ( options.rated ? "unrated." : "rated." );
    }else if( !details.clock || ( // no clock - unlimited or coorespondence
        details.clock && ( //clock
            !_.isEqual(details.clock.initial, options.clock.initial * 60) || // initial time
            !_.isEqual(details.clock.increment, options.clock.increment) ) // increment
        ) 
    ){
        //the time control does not match options
        result.valid = false;
        result.reason = "the time control is incorrect."
    }else if(!_.isEqual(details.variant, options.variant)){
        //the variant does not match
        result.valid = false;
        result.reason = "the variant should be standard."
    }else{
        //the link is too old or too new
        var extrema = spreadsheets.getRoundExtrema(options);
        var game_start = moment.utc(details.timestamp);
        if(game_start.isBefore(extrema.start) || game_start.isAfter(extrema.end)){
            result.valid = false;
            result.reason = "the game was not played in the current round.";
        }
    }
    return result;
}

function gamelinkReplyInvalid(bot, message, reason){
    bot.reply(message, "I am sorry, <@" + message.user + ">,  "
                     + "your post is *not valid* because "
                     + "*" + reason + "*");
    bot.reply(message, "If this was a mistake, please correct it and "
                     + "try again. If intentional, please contact one "
                     + "of the moderators for review. Thank you.");
}

function replyGenericFailure(bot, message, contact){
    bot.reply(message, "Something went wrong. Notify " + contact);
}

function gamelinkReplyUnknown(bot, message){
    bot.reply(message, "Sorry, I could not find that game. Please verify your gamelink.");
}

function validateUserResult(details, result){
    //if colors are reversed, in the game link, we will catch that later
    //we know the players are correct or we would not already be here
    //the only way we can validate the result is if the order is 100% correct.
    var validity = {
        valid: true,
        reason: ""
    };
    if( details.winner && _.isEqual(result.result, "1/2-1/2")){
        //the details gave a winner but the user claimed draw
        validity.reason = "the user claimed a draw " 
                        + "but the gamelink specifies " + details.winner + " as the winner.";
        validity.valid = false;
   }else if(_.isEqual(details.winner, "black") && _.isEqual(result.result, "1-0")){
        //the details gave the winner as black but the user claimed white
        validity.reason = "the user claimed a win for white " 
                        + "but the gamelink specifies black as the winner.";
        validity.valid = false;
    }else if(_.isEqual(details.winner, "white") && _.isEqual(result.result, "0-1")){
        //the details gave the winner as white but the user claimed black
        validity.reason = "the user claimed a win for black " 
                        + "but the gamelink specifies white as the winner.";
        validity.valid = false;
    }else if(_.isEqual(details.status, "draw") && !_.isEqual(result.result, "1/2-1/2")){
        //the details gave a draw but the user did not claim a draw
        validity.reason = "the user claimed a decisive result " 
                        + "but the gamelink specifies a draw.";
        validity.valid = false;
    }
    return validity;
}

function processGamelink(bot, message, gamelink, options, userResult){
    //get the gamelink id if one is in the message
    var result = spreadsheets.parseGamelink(gamelink);
    if(!result.gamelinkID){
        //no gamelink found. we can ignore this message
        return;
    }
    //get the game details
    fetchGameDetails(result.gamelinkID, function(error, details){
        //validate the game details vs the user specified result
        if(details){
            if(userResult){
                var validity = validateUserResult(details, userResult);
                if(!validity.valid){
                    gamelinkReplyInvalid(bot, message, validity.reason);
                    return;
                }
            }
            processGameDetails(bot, message, details, options);
        }else{
            console.error(JSON.stringify(error));
            bot.reply(message, "Sorry, I failed to get game details for " + gamelink + ". Try again later or reach out to a moderator to make the update manually.");
        }
    });
}

function processGameDetails(bot, message, details, options){
    //if no details were found the link was no good
    if(!details){
        gamelinkReplyUnknown(bot, message);
        return;
    }

    //verify the game meets the requirements of the channel we are in
    var validity = validateGameDetails(details, options);
    if(!validity.valid){
        //game was not valid
        gamelinkReplyInvalid(bot, message, validity.reason);
        return;
    }
    var result = {};
    //our game is valid
    //get players to update the result in the sheet
    var white = details.players.white;
    var black = details.players.black;
    result.white = users.getByNameOrID(white.userId);
    result.black = users.getByNameOrID(black.userId);
    result.gamelinkID = details.id;
 
    //get the result in the correct format
    if(_.isEqual(details.status, "draw") || _.isEqual(details.status, "stalemate") || details.winner){
        if(_.isEqual(details.winner, "black")){
            result.result = "0-1";
        }else if(_.isEqual(details.winner, "white")){
            result.result = "1-0";
        }else{
            result.result = "1/2-1/2";
        }
    }else{
        result.result = "\u2694";
    }
    //gamelinks only come from played games, so ignoring forfeit result types

    //update the spreadsheet with results from gamelink
    spreadsheets.updateResult(
        message.league.options.spreadsheet,
        result,
        function(err, reversed){
            if (err) {
                if (_.includes(err, "Unable to find pairing.")) {
                    resultReplyMissingPairing(bot, message);
                }else if(reversed){
                    gamelinkReplyInvalid(bot, message, err);
                }else{
                    replyGenericFailure(bot, message, "@endrawes0");
                    throw new Error("Error updating scheduling sheet: " + err);
                }
            } else {
                resultReplyUpdated(bot, message, result);
            }
        }
    );
}

// gamelink processing will occur on any message
chesster.on({
    event: 'ambient',
    middleware: [slack.withLeague]
},
function(bot, message) {
    if (!message.league) {
        return;
    }
    var channel = channels.byId[message.channel];
    if (!channel) {
        return;
    }
    var spreadsheetOptions = message.league.options.spreadsheet;
    if (!spreadsheetOptions) {
        console.error("{} league doesn't have spreadsheet options!?".format(message.league.options.name));
        return;
    } 
    var gamelinkOptions = message.league.options.gamelinks;
    if (!gamelinkOptions || !_.isEqual(channel.name, gamelinkOptions.channel)) {
        return;
    }

    try{
        processGamelink(bot, message, message.text, gamelinkOptions);
    }catch(e){
        //at the moment, we do not throw from inside the api - rethrow
        throw e;
    }
});

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
    patterns: ['^subscriptions$'],
    messageTypes: ['direct_message']
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        subscription.processSubscriptionsCommand(chesster.config, message).then(function(response) {
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
    patterns: [/^remove subscription (\d+)$/],
    messageTypes: ['direct_message']
},
function(bot, message) {
    var deferred = Q.defer();
    bot.startPrivateConversation(message, function (response, convo) {
        subscription.processRemoveSubscriptionCommand(chesster.config, message, message.match[1]).then(function(response) {
            convo.say(response);
            deferred.resolve();
        }).catch(function(error) {
            convo.say("I'm sorry, but an error occurred processing this subscription command");
            deferred.reject(error);
        });
    });
    return deferred.promise;
});

subscription.emitter.on('a-game-is-scheduled', function(bot, message, l, results, white, black) {
    // TODO: encase this in a exception Handler
    _.each([white.name, black.name], function(source) {
        // TODO: this will also need to deal with channels at some point
        subscription.getListeners(l.options.name, source, 'a-game-is-scheduled').then(function(targets) {
            _.each(targets, function(target) {
                target = player.getSlackUserFromNameOrID(slack.users, target);
                if (!_.isUndefined(target)) {
                    bot.startPrivateConversation({user: target.id}, function(err, convo) {
                        // TODO: this could be a much better message!
                        convo.say("{white} vs {black} has been scheduled for {date}.".format({
                            white: white.name,
                            black: black.name,
                            date: "TODO",
                        }));
                    });
                } else {
                    // TODO: probably delete the subscription at this point.
                }
            });
        }).catch(function(error) {
            console.error("ERROR: " + error);
        });
    });
});
