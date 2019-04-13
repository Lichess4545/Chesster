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
    "host": "localhost",
    "dialect": "postgres",
    "logging": false,
    "pool": {
        "max": 5,
        "min": 0,
        "idle": 10000
    },
    "storage": "",
    "watcherBaseURL": "https://lichess.org/api/stream/games-by-users",

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
    "heltour": {
        "token": heltour_token,
        "baseEndpoint": "https://www.lichess4545.com/api/"
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
                "registration": "https://www.lichess4545.com/team4545/register/",
                "availability": "https://www.lichess4545.com/team4545/availability/edit/",
                "nominate": "https://www.lichess4545.com/team4545/nominate/",
                "notifications": "https://www.lichess4545.com/team4545/notifications/"
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
                "registration": "https://www.lichess45454.com/lonewolf/register/",
                "availability": "https://www.lichess4545.com/lonewolf/availability/edit/",
                "nominate": "https://www.lichess4545.com/lonewolf/nominate/",
                "notifications": "https://www.lichess4545.com/lonewolf/notifications/"
            }
        },
        "blitzbattle": {
            "name": "Blitz Battle",
            "also_known_as": [
                "blitz",
                "32",
            ],
            "heltour": {
                "token": heltour_token,
                "baseEndpoint": "https://www.lichess4545.com/api/", 
                "leagueTag": "blitzbattle"
            },
            "results": {
                "channel": "blitz-battle-games",
                "channel_id": "C3TV7T648"
            },
            "gamelinks": {
                "channel": "blitz-battle-games",
                "channel_id": "C3TV7T648",
                "clock": {
                    "initial": 3,
                    "increment": 2
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
            "links": {
                "faq": "https://www.lichess4545.com/blitzbattle/document/faq/",
                "rules": "https://www.lichess4545.com/blitzbattle/document/rules/",
                "league": "https://www.lichess4545.com/blitzbattle/",
                "pairings": "https://www.lichess4545.com/blitzbattle/pairings/",
                "standings": "https://www.lichess4545.com/blitzbattle/standings/",
                "registration": "https://www.lichess45454.com/blitzbattle/register/",
                "availability": "https://www.lichess4545.com/blitzbattle/availability/edit/",
                "nominate": "https://www.lichess4545.com/blitzbattle/nominate/",
                "notifications": "https://www.lichess4545.com/blitzbattle/notifications/"
            }
        },
        "chess960": {
            "name": "Lichess 960",
            "also_known_as": [
                "960",
                "1510"
            ],
            "heltour": {
                "token": heltour_token,
                "baseEndpoint": "https://www.lichess4545.com/api/",
                "leagueTag": "chess960"
            },
            "results": {
                "channel": "chess960games",
                "channel_id": "CAG3R6HL6"
            },
            "gamelinks": {
                "channel": "chess960games",
                "channel_id": "CAG3R6HL6",
                "clock": {
                    "initial": 15,
                    "increment": 10
                },
                "rated": true,
                "variant" : "chess960",
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
                    "hour": 17,
                    "minute": 0,
                    "warningHours": 1
                },
                "warningMessage": "Hi! Glad you got your game scheduled. Be warned though - it's cutting it pretty close to deadline! Please be on time and prompt with your game time, the league depends on it! Thanks, and if you have any questions, please contact the moderators.",
                "lateMessage": "Hi! Sorry, that time you posted is not an acceptable time. We need all games to end by 23:00 GMT on Monday, and we believe if you start then, you won't be done then! Please try and find a better time, and if you cannot, please contact the moderators.",
                "format": "MM/DD HH:mm",
                "channel": "chess960scheduling"
            },
            "links": {
                "faq": "https://www.lichess4545.com/chess960/document/faq/",
                "rules": "https://www.lichess4545.com/chess960/document/rules/",
                "league": "https://www.lichess4545.com/chess960/",
                "pairings": "https://www.lichess4545.com/chess960/pairings/",
                "standings": "https://www.lichess4545.com/chess960/standings/",
                "registration": "https://www.lichess45454.com/chess960/register/",
                "availability": "https://www.lichess4545.com/chess960/availability/edit/",
                "nominate": "https://www.lichess4545.com/chess960/nominate/",
                "notifications": "https://www.lichess4545.com/chess960/notifications/"
            }
        },
    },
    "channel_map": {
        "lonewolf-general": "lonewolf",
        "lonewolf-games": "lonewolf",
        "lonewolf-scheduling": "lonewolf",
        "unstable_bot-lonewolf": "lonewolf",
        "blitz-battle": "blitzbattle",
        "blitz-battle-games": "blitzbattle",
        "unstable_bot-blitz": "blitzbattle",
        "general": "45+45",
        "team-general": "45+45",
        "team-games": "45+45",
        "team-scheduling": "45+45",
        "captains": "45+45",
        "G0DFRURGQ": "45+45",
        "chess960": "chess960",
        "chess960games": "chess960",
        "chess960scheduling": "chess960",
        "unstable_bot-chess960": "chess960",
    },
    "messageForwarding": {
        "channel": "G3D6N2HNF",
    }
}
module.exports = config;
