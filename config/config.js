// NOTE: None of these files are committed and for good reason.
//       You must provide your own.
var token = require("./slack_token.js").token;
var private_key = require("./service_account_key.js").key;
var heltour_token = require("./heltour_token.js").token;

try {
    var logging_token = require("./logging_token.js").token;
} catch (e) {
    var logging_token = null;
}

var config = {
    // Unfortunately this all has to be at the top level due to sequelize-cli
    "database": "",
    "username": "",
    "password": "",
    "dialect": "sqlite",
    "logging": false,
	"pool": {
		"max": 5,
		"min": 0,
		"idle": 10000
	},
    "storage": "./db/database.sqlite",

    "token": token,
    "winston": {
        domain: "chesster",
        channel: "#lichess4545-logging",
        token: logging_token,
        username: "chesster",
        level: "debug",
        handleExceptions: true
    },
    "links": {
        "source": "https://github.com/endrawes0/Chesster"
    },

    "leagues": {
        "45+45": {
            "name": "45+45",
            "also_known_as": [
                "4545",
                "Team",
                "45",
            ],
            "moderators": [
                "endrawes0",
                "mkoga",
                "mrlegilimens",
                "petruchio",
                "seb32",
                "theino",
                "tnan123",
                "angborxley",
                "prune2000",
            ],
            "heltour": {
                "token": heltour_token,
                "base_endpoint": "https://www.lichess4545.com/api/", 
                "league_tag": "team4545"
            },
            "spreadsheet": {
                "key": "1cTBOQNrbUw9-RWmrC9b6Yyi3i2MtIvUWuXNxzQmGfSs",
                "serviceAccountAuth": {
                    "client_email": "chesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
                    "private_key": private_key,
                },
                "scheduleColname": "time (mm/dd @ hh:mm*)",
                "resultsColname": "result"
            },
            "results": {
                "channel": "team-results"
            },
            "gamelinks": {
                "channel": "team-gamelinks",
                "clock": {
                    "initial": 45,
                    "increment": 45
                },
                "rated": true,
                "variant" : "standard",
                "extrema": {
                    "iso_weekday": 1,
                    "hour": 11,
                    "minute": 0,
                    "warning_hours": 1
                }
            },
            "scheduling": {
                "extrema": {
                    "isoWeekday": 1,
                    "hour": 11,
                    "minute": 0,
                    "warningHours": 1
                },
                "warningMessage": "Hi! Glad you got your game scheduled. Be warned though - it's cutting it pretty close to deadline! Please be on time and prompt with your game time, the league depends on it! Thanks, and if you have any questions, please contact the moderators.",
                "lateMessage": "Hi! Sorry, that time you posted is not an acceptable time. We need all games to end by 12:00 GMT on Monday, and we believe if you start then, you won't be done then! Please try and find a better time, and if you cannot, please contact the moderators.",
                "format": "MM/DD @ HH:mm",
                "channel": "team-scheduling"
            },
            "links": {
                "rules": "https://lichess4545.slack.com/files/endrawes0/F1ARYEKT3/lichess4545leaguerulesregulations",
                "team": "https://lichess4545.slack.com/files/mrlegilimens/F1J8DMUHJ/lichess4545season4-formresponses1",
                "guide": "http://bit.ly/1MW9YJ4",
                "captains": "https://lichess4545.slack.com/files/endrawes0/F0V3SPE90/guidelinesforlichess4545teamcaptains2.doc",
                "registration": "https://docs.google.com/forms/d/1Fx5XL4NZBK-8ADxndWDuH-XLuJDI90ZVKR4GhKs9Ols/viewform"
            }
        },
        "lonewolf": {
            "name": "Lone Wolf",
            "also_known_as": [
                "lonewolf",
                "3030",
                "30",
                "lw",
                "lonewolf",
                "wolf",
            ],
            "moderators": [
                "endrawes0",
                "jptriton",
                "lakinwecker",
                "theino"
            ],
            "heltour": {
                "token": heltour_token,
                "base_endpoint": "https://www.lichess4545.com/api/", 
                "league_tag": "lonewolf"
            },
            "spreadsheet": {
                "key": "1WI4H9DWKSI-q6Omeqh28w1lKaqB0AAFV01wDiOeW6Ho",
                "serviceAccountAuth": {
                    "client_email": "chesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
                    "private_key": private_key,
                },
                "scheduleColname": "game scheduled (in gmt)",
                "resultsColname": "result"
            },
            "results": {
                "channel": "lonewolf-results"
            },
            "gamelinks": {
                "channel": "lonewolf-gamelinks",
                "clock": {
                    "initial": 30,
                    "increment": 30
                },
                "rated": true,
                "variant" : "standard",
                "extrema": {
                    "iso_weekday": 1,
                    "hour": 22,
                    "minute": 0,
                    "warning_hours": 1
                }

            },
            "scheduling": {
                "extrema": {
                    "isoWeekday": 1,
                    "hour": 22,
                    "minute": 0,
                    "warningHours": 1
                },
                "warningMessage": "Hi! Glad you got your game scheduled. Be warned though - it's cutting it pretty close to deadline! Please be on time and prompt with your game time, the league depends on it! Thanks, and if you have any questions, please contact the moderators.",
                "lateMessage": "Hi! Sorry, that time you posted is not an acceptable time. We need all games to end by 23:00 GMT on Monday, and we believe if you start then, you won't be done then! Please try and find a better time, and if you cannot, please contact the moderators.",
                "format": "MM/DD HH:mm",
                "channel": "lonewolf-scheduling"
            },
            "links": {
                "rules": "https://docs.google.com/document/d/105gEd79MdUVIt4pW_T_BsX-TvSyNB1lvNJ9p73k9gFo/edit",
                "team": "https://docs.google.com/spreadsheets/d/1p8RMKSKDryavipF5RzNOxIhonK5lOf6OkQPtpkzCRng/",
            }
        },
    },
    "channel_map": {
        "lonewolf-general": "lonewolf",
        "lonewolf-results": "lonewolf",
        "lonewolf-gamelinks": "lonewolf",
        "lonewolf-scheduling": "lonewolf",
        "unstable_bot-lonewolf": "lonewolf",
        "general": "45+45",
        "team-general": "45+45",
        "team-results": "45+45",
        "team-gamelinks": "45+45",
        "team-scheduling": "45+45",
        "unstable_bot": "45+45"
    },
}
module.exports = config;
