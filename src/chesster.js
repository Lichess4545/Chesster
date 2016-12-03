// extlibs
var moment = require('moment-timezone');
var Q = require("q");
var _ = require("lodash");
var winston = require("winston");

// Our stuff
var gamelinks = require('./gamelinks.js');
var results = require('./results.js');
var heltour = require('./heltour.js');
var http = require("./http.js");
var league = require("./league.js");
var lichess = require('./lichess.js');
var slack = require('./slack.js');
var subscription = require('./subscription.js');
var commands = require('./commands.js');
//const watcher = require('./watcher.js');
const availability = require("./commands/availability.js");
const nomination = require("./commands/nomination.js");
const scheduling = require("./commands/scheduling.js");
const leagueInfo = require("./commands/leagueInfo.js");

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

function prepareRatingMessage(_player, rating){
    return _player + " is rated " + rating + " in classical chess";
}

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
        ).then(function() {
            deferred.resolve();
        }, function(error) {
            deferred.reject(error);
        });
    });
    return deferred.promise;
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
chesster.on({
    event: 'ambient',
    middleware: [slack.withLeagueByChannelName]
},
function(bot, message) {
    if(!message.league){
        return;
    }
    var resultsOptions = message.league.options.results; 
    var channel = channels.byId[message.channel];
    if (!channel) {
        return;
    }
    if (!resultsOptions || !_.isEqual(channel.name, resultsOptions.channel)){
        return;
    }

    var heltourOptions = message.league.options.heltour;
    if (!heltourOptions) {
        winston.error("{} league doesn't have heltour options!?".format(message.league.options.name));
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

        result.white = users.getByNameOrID(result.white.replace(/[<\@>]/g, ''));
        result.black = users.getByNameOrID(result.black.replace(/[<\@>]/g, ''));

        if(
            !_.isEqual(result.white.id, message.user) &&
            !_.isEqual(result.black.id, message.user) &&
            !message.player.isModerator()
        ){
            replyPermissionFailure(bot, message);
            return;
        }
        
        return heltour.findPairing(
            heltourOptions,
            result.white.name,
            result.black.name,
            heltourOptions.leagueTag
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
                var speaker = slack.getSlackUserFromNameOrID(message.user);
                if(message.league.isModerator(speaker.name)){
                    //current speaker is a moderator for the league
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
                    resultReplyMissingGamelink(bot, message);
                }
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

function resultReplyMissingGamelink(bot, message){
    var channel = channels.byName[message.league.options.gamelinks.channel];
    bot.reply(message, "Sorry, that game does not have a link. I will not update the result without it.");
    bot.reply(message, "Please go to <#" +channel.id + "> and post the gamelink.");
}

function resultReplyMissingPairing(bot, message){
    bot.reply(message, "Sorry, I could not find that pairing.");
}

function resultReplyTooManyPairings(bot, message){
    bot.reply(message, "Sorry, I found too many pairings matching this. Please contact a mod.");
}

function resultReplyUpdated(bot, message, result){
    bot.reply(message, "Got it. @" + result.white.name + " " + (result.result || SWORDS) + " @" + result.black.name);
}



/* game link parsing */

//given a gamelinkID, use the lichess api to get the game details
//pass the details to the callback as a JSON object
function fetchGameDetails(gamelinkID){
    return http.fetchURLIntoJSON("http://en.lichess.org/api/game/" + gamelinkID);
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
        var details = response['json'];
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
    var validity = league.validateGameDetails(details);
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
    return heltour.updatePairing(
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
                    'result': result,
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
    if (!message.league) {
        return;
    }
    var channel = channels.byId[message.channel];
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
    return "{white.name} vs {black.name} in {leagueName} has started: {result.gamelink}".format(context);
});

subscription.register(chesster, 'a-game-is-over', function(target, context) {
    return "{white.name} vs {black.name} in {leagueName} is over. The result is {result.result}.".format(context);
});


//------------------------------------------------------------------------------
// Start the watcher.
//watcher.watch(chesster);
