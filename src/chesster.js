// extlibs
var fs = require('fs');
var moment = require('moment');
var Q = require("q");
var _ = require("lodash");
var winston = require("winston");

// Our stuff
var fuzzy = require('./fuzzy_match.js');
var gamelinks = require('./gamelinks.js');
var results = require('./results.js');
var heltour = require('./heltour.js');
var http = require("./http.js");
var league = require("./league.js");
var lichess = require('./lichess.js');
var scheduling = require('./scheduling.js');
var slack = require('./slack.js');
var subscription = require('./subscription.js');

var users = slack.users;
var channels = slack.channels;

var SWORDS = "\u2694";

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
        winston.error(error_log);
        if (on_error) {
            on_error();
        }
    }
}

function bot_exception_handler(bot, message, todo){
    exception_handler(todo, function(){
        winston.error("Message: " + JSON.stringify(message));
        bot.reply(message, "Something has gone terribly terribly wrong. Please forgive me.");
    });
}

function critical_path(todo){
    exception_handler(todo, function(){
        winston.error("An exception was caught in a critical code-path. I am going down.");
        process.exit(1);
    });
}

/* static entry point */

var config_file = process.argv[2] || "../config/config.js"; 
var chesster = new slack.Bot({
    config_file: config_file
});

function handleHeltourErrors(bot, message, error){
    if (_.isEqual(error, "no_matching_rounds")) {
        replyNoActiveRound(bot, message);
    } else if (_.isEqual(error, "no_pairing")) {
        resultReplyMissingPairing(bot, message);
    } else if (_.isEqual(error, "ambiguous")) {
        resultReplyTooManyPairings(bot, message);
    } else {
        replyGenericFailure(bot, message, "@endrawes0");
        throw new Error("Error making your update: " + err);
    }
}

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

/* game nomination */
chesster.hears({
    middleware: [ slack.requiresLeague ],
    patterns: [ 'nomination' ],
    messageTypes: [ 'direct_message' ]
},
function(bot, message) {
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }

    var speaker = users.getByNameOrID(message.user);
    heltour.getPrivateURL(
        heltourOptions,
        'nominate', //hardcoding this for now
        speaker.name
    ).then(function(jsonResult){
        bot.reply(message, "Use this link to nominate your choice: {}".format(jsonResult.url));
        bot.reply(message, "NOTE: this is a private link. Do not share it.");
        bot.reply(message, "This link will expire at: {}".format(jsonResult.expires));
    }).catch(function(error){
        winston.error("[NOMINATION] private link acquisition failure: {}".format(error));
        bot.reply(message, "I failed to get your private link. Please ask @endrawes0 for help.");
    });
});

/* rating */

chesster.hears({
    patterns: [slack.appendPlayerRegex("rating", true)],
    messageTypes: [
        'direct_mention', 
        'direct_message'
    ]
},
function(bot,message) {
    var playerName = slack.getSlackUser(message).name;
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
        "    [ pairing | pairing <player> ] ! get your (or given <player>) latest pairings with scheduled time\n" +
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
        slack.appendPlayerRegex("pairing", true)
    ],
    messageTypes: [
        'direct_mention', 'direct_message'
    ]
}, function(bot, message) {
    var targetPlayer = slack.getSlackUser(message);
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
                    winston.error("error");
                    winston.error(JSON.stringify(error));
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
    bot_exception_handler(bot, message, _.noop) 
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


// There is not active round
function replyNoActiveRound(bot, message) {
    var user = "<@"+message.user+">";
    bot.reply(message, ":x: " + user + " There is currently no active round. If this is a mistake, contact a mod");
}

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
    middleware: [slack.withLeagueByChannelName]
},
function(bot, message) {
    var channel = channels.byId[message.channel];
    var deferred = Q.defer();
    if (!message.league) {
        deferred.resolve();
        return deferred.promise;
    }
    if (!channel) {
        deferred.resolve();
        return deferred.promise;
    }
    var schedulingOptions = message.league.options.scheduling;
    if (!schedulingOptions) {
        winston.error("[SCHEDULING] {} league doesn't have scheduling options!?".format(message.league.options.name));
        deferred.resolve();
        return deferred.promise;
    } 
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("[SCHEDULING] {} league doesn't have heltour options!?".format(message.league.options.name));
        deferred.resolve();
        return deferred.promise;
    } 
    if (!_.isEqual(channel.name, schedulingOptions.channel)) {
        deferred.resolve();
        return deferred.promise;
    }

    var referencesSlackUsers = false;

    var schedulingResults = {
        white: '',
        black: ''
    };

    // Step 1. See if we can parse the dates
    try {
        schedulingResults = scheduling.parseScheduling(message.text, schedulingOptions);
    } catch (e) {
        if (!(e instanceof (scheduling.ScheduleParsingError))) {
            throw e; // let others bubble up
        } else {
            winston.debug("[SCHEDULING] Received an exception: {}".format(JSON.stringify(e)));
            winston.debug("[SCHEDULING] Stack: {}".format(e.stack));
        }
        return;
    }

    // Step 2. See if we have valid named players
    var white = users.getByNameOrID(schedulingResults.white);
    var black = users.getByNameOrID(schedulingResults.black);
    if (white && black) {
        schedulingResults.white = white.name;
        schedulingResults.black = black.name;
        referencesSlackUsers = true;
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

    winston.debug("[SCHEDULING] Attempting to update the spreadsheet.");
    // Step 3. attempt to update the spreadsheet
    heltour.updateSchedule(
        heltourOptions,
        schedulingResults
    ).then(function(response) {
        updateScheduleResults = response['json'];
        if (updateScheduleResults['updated'] === 0) {
            if (updateScheduleResults['error'] === 'not_found') {
                schedulingReplyMissingPairing(bot, message);
                deferred.resolve();
            } else if (updateScheduleResults['error'] === 'no_data') {
                replyNoActiveRound(bot, message);
                deferred.resolve();
            } else if (updateScheduleResults['error'] === 'ambiguous') {
                schedulingReplyAmbiguous(bot, message);
                deferred.resolve();
            } else {
                bot.reply(message, "Something went wrong. Notify a mod");
                deferred.reject("Error updating schedule: " + JSON.stringify(updateScheduleResults));
            }
            return;
        }
        if (updateScheduleResults['reversed']) {
            var tmp = white;
            white = black;
            black = tmp;
        }

        if (schedulingResults.outOfBounds) {
            schedulingReplyTooLate(bot, message, schedulingOptions);
            return;
        }
        if (schedulingResults.warn) {
            schedulingReplyTooCloseToCutoff(bot, message, schedulingOptions, white, black);
        }
        
        var leagueName = message.league.options.name;
        schedulingReplyScheduled(bot, message, schedulingResults, white, black);
        // TODO: test this.
        subscription.emitter.emit('a-game-is-scheduled',
            message.league,
            [white.name, black.name],
            {
                'result': schedulingResults,
                'white': white,
                'black': black,
                'leagueName': leagueName
            }
        );
        deferred.resolve();
    });
    return deferred.promise;
});



/* results parsing */

// results processing will occur on any message
chesster.on({
    event: 'ambient',
    middleware: [slack.withLeagueByChannelName]
},
function(bot, message) {
    var channel = channels.byId[message.channel];
    if (!message.league) {
        return;
    }
    if (!channel) {
        return;
    }
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    }

    var resultsOptions = message.league.options.results; 
    if (!resultsOptions || !_.isEqual(channel.name, resultsOptions.channel)){
        return;
    }

    var gamelinkOptions = message.league.options.gamelinks;
    if (!gamelinkOptions) {
        return;
    }

    try{
        var result = results.parseResult(message.text);

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
        
        heltour.findPairing(
            heltourOptions,
            result.white.name,
            result.black.name,
            heltourOptions.league_tag
        ).then(function(findPairingResult){
            if(findPairingResult["error"]){
                handleHeltourErrors(bot, message, findPairingResult["error"]);
                return;
            }

            var pairing = _.head(findPairingResult["json"].pairings);
            if( !_.isNil(pairing) 
                && !_.isNil(pairing.game_link) 
                && !_.isEqual(pairing.game_link, "")){
                //process game details
                processGamelink(
                    bot, 
                    message,
                    pairing.game_link,
                    gamelinkOptions,
                    heltourOptions,
                    result);
            }else if(!_.isNil(pairing)){
                //update the pairing with the result bc there was no link found
                heltour.updatePairing(
                    heltourOptions,
                    result
                ).then(function(updatePairingResult) {
                    if (updatePairingResult['error']) {
                        handleHeltourErrors(bot, message, updatePairingResult['error']);
                        return;
                    }
                    resultReplyUpdated(bot, message, updatePairingResult);

                    var leagueName = message.league.options.name;
                    var white = result.white;
                    var black = result.black;
                    if(updatePairingResult['resultChanged'] && !_.isEmpty(updatePairingResult.result)){
                        subscription.emitter.emit('a-game-is-over',
                            message.league,
                            [white.name, black.name],
                            {
                                'result': updatePairingResult,
                                'white': white,
                                'black': black,
                                'leagueName': leagueName
                            }
                        );
                    }
                });
            }else{
                resultReplyMissingPairing(bot, message);
            }
        });

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

function resultReplyTooManyPairings(bot, message){
    bot.reply(message, "Sorry, I found too many pairings matching this. Please contact a mod.");
}

function resultReplyUpdated(bot, message, result){
    bot.reply(message, "Got it. @" + result.white.name + " " + result.result + " @" + result.black.name);
}



/* game link parsing */

//given a gamelinkID, use the lichess api to get the game details
//pass the details to the callback as a JSON object
function fetchGameDetails(gamelinkID){
    return http.fetchURLIntoJSON("http://en.lichess.org/api/game/" + gamelinkID);
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
        var extrema = scheduling.getRoundExtrema(options);
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

function processGamelink(bot, message, gamelink, options, heltourOptions, userResult){
    //get the gamelink id if one is in the message
    var result = gamelinks.parseGamelink(gamelink);
    if(!result.gamelinkID){
        //no gamelink found. we can ignore this message
        return;
    }
    //get the game details
    return fetchGameDetails(result.gamelinkID).then(function(response) {
        var details = response['json']
        //validate the game details vs the user specified result
        if(userResult){
            var validity = validateUserResult(details, userResult);
            if(!validity.valid){
                gamelinkReplyInvalid(bot, message, validity.reason);
                return;
            }
        }
        return processGameDetails(bot, message, details, options, heltourOptions);
    }).catch(function(error) {
        winston.error(JSON.stringify(error));
        bot.reply(message, "Sorry, I failed to get game details for " + gamelink + ". Try again later or reach out to a moderator to make the update manually.");
    });
}

function processGameDetails(bot, message, details, options, heltourOptions){
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
    result.gamelink =  "http://en.lichess.org/" + result.gamelinkID;
 
    //get the result in the correct format
    if(_.isEqual(details.status, "draw") || _.isEqual(details.status, "stalemate") || details.winner){
        if(_.isEqual(details.winner, "black")){
            result.result = "0-1";
        }else if(_.isEqual(details.winner, "white")){
            result.result = "1-0";
        }else{
            result.result = "1/2-1/2";
        }
    }

    //gamelinks only come from played games, so ignoring forfeit result types

    //update the spreadsheet with results from gamelink
    heltour.updatePairing(
        heltourOptions,
        result
    ).then(function(updatePairingResult) {

        if (updatePairingResult['error']) {
            handleHeltourErrors(bot, message, updatePairingResult['error']);
            return; //if there was a problem with heltour, we should not take further steps 
        }
        resultReplyUpdated(bot, message, updatePairingResult);

        var leagueName = message.league.options.name;
        var white = result.white;
        var black = result.black;
        if(updatePairingResult['resultChanged'] && !_.isEmpty(updatePairingResult.result)){
            // TODO: Test this.
            subscription.emitter.emit('a-game-is-over',
                message.league,
                [white.name, black.name],
                {
                    'result': updatePairingResult,
                    'white': white,
                    'black': black,
                    'leagueName': leagueName
                }
            );
        }else if(updatePairingResult['gamelinkChanged']){
            // TODO: Test this.
            subscription.emitter.emit('a-game-starts',
                message.league,
                [white.name, black.name],
                {
                    'result': updatePairingResult,
                    'white': white,
                    'black': black,
                    'leagueName': leagueName
                }
            );
        }
    });
}

// gamelink processing will occur on any message
chesster.on({
    event: 'ambient',
    middleware: [slack.withLeagueByChannelName]
},
function(bot, message) {
    var channel = channels.byId[message.channel];
    if (!message.league) {
        return;
    }
    if (!channel) {
        return;
    }
    var gamelinkOptions = message.league.options.gamelinks;
    if (!gamelinkOptions || !_.isEqual(channel.name, gamelinkOptions.channel)) {
        return;
    }
    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("[GAMELINK] {} league doesn't have heltour options!?".format(message.league.options.name));
        return;
    } 

    try{
        return processGamelink(bot, message, message.text, gamelinkOptions, heltourOptions);
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
    return "{white.name} vs {black.name} in {leagueName} has started: https://en.lichess.org/{result.gamelinkID}".format(context);
});

subscription.register(chesster, 'a-game-is-over', function(target, context) {
    return "{white.name} vs {black.name} in {leagueName} is over. The result is {result.result}.".format(context);
});

