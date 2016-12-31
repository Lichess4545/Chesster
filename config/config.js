// NOTE: None of these files are committed and for good reason.
//       You must provide your own.
var token = require("./slack_token.js").token;
var heltour_token = require("./heltour_token.js").token;

try {
    var chesster_slack_token = require("./chesster_slack_token.js").token;
} catch (e) {
    var chesster_slack_token = null;
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
    "watcherBaseURL": "https://en.lichess.org/api/game-stream",

    "slack_tokens": {
        "lichess4545": token,
        "chesster": chesster_slack_token,
    },
    "winston": {
        domain: "chesster",
        channel: "#lichess4545-logging",
        username: "chesster",
        level: "debug",
        handleExceptions: true
    },
    "links": {
        "source": "https://github.com/endrawes0/Chesster"
    },
    "welcome": {
        "channel": "general"
    },
    "leagues": {
        "45+45": {
            "name": "45+45",
            "also_known_as": [
                "4545",
                "Team",
                "45",
            ],
            "heltour": {
                "token": heltour_token,
                "baseEndpoint": "https://www.lichess4545.com/api/", 
                "leagueTag": "team4545"
            },
            "spreadsheet": {
                "key": "1cTBOQNrbUw9-RWmrC9b6Yyi3i2MtIvUWuXNxzQmGfSs",
                "serviceAccountAuth": {
                    "client_email": "chesster@chesster-lichess-4545-bot.iam.gserviceaccount.com"
                },
                "scheduleColname": "time (mm/dd @ hh:mm*)",
                "resultsColname": "result"
            },
            "results": {
                "channel": "team-games",
                "channel_id": "C0CSAHD43"
            },
            "gamelinks": {
                "channel": "team-games",
                "channel_id": "C0CSAHD43",
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
            "alternate": {
                "channel_id": "G0DFRURGQ"
            },
            "links": {
                "faq": "https://www.lichess4545.com/team4545/document/faq/",
                "rules": "https://www.lichess4545.com/team4545/document/rules/",
                "league": "https://www.lichess4545.com/team4545/",
                "pairings": "https://www.lichess4545.com/team4545/pairings/",
                "standings": "https://www.lichess4545.com/team4545/standings/",
                "guide": "https://www.lichess4545.com/team4545/document/player-handbook/",
                "captains": "https://www.lichess4545.com/team4545/document/captains/",
                "registration": "https://www.lichess4545.com/team4545/register/"
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
            "heltour": {
                "token": heltour_token,
                "baseEndpoint": "https://www.lichess4545.com/api/", 
                "leagueTag": "lonewolf"
            },
            "spreadsheet": {
                "key": "1WI4H9DWKSI-q6Omeqh28w1lKaqB0AAFV01wDiOeW6Ho",
                "serviceAccountAuth": {
                    "client_email": "chesster@chesster-lichess-4545-bot.iam.gserviceaccount.com"
                },
                "scheduleColname": "game scheduled (in gmt)",
                "resultsColname": "result"
            },
            "results": {
                "channel": "lonewolf-games",
                "channel_id": "C0SD3SCAH"
            },
            "gamelinks": {
                "channel": "lonewolf-games",
                "channel_id": "C0SD3SCAH",
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
                "faq": "https://www.lichess4545.com/lonewolf/document/faq/",
                "rules": "https://www.lichess4545.com/lonewolf/document/rules/",
                "league": "https://www.lichess4545.com/lonewolf/",
                "pairings": "https://www.lichess4545.com/lonewolf/pairings/",
                "standings": "https://www.lichess4545.com/lonewolf/standings/",
                "registration": "https://www.lichess45454.com/lonewolf/register/"
            }
        },
    },
    "channel_map": {
        "lonewolf-general": "lonewolf",
        "lonewolf-games": "lonewolf",
        "lonewolf-scheduling": "lonewolf",
        "unstable_bot-lonewolf": "lonewolf",
        "general": "45+45",
        "team-general": "45+45",
        "team-results": "45+45",
        "team-games": "45+45",
        "captains": "45+45",
        "G0DFRURGQ": "45+45",
    },
    "messageForwarding": {
        "channel": "G3D6N2HNF",
    }
}
module.exports = config;
