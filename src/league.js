//------------------------------------------------------------------------------
// Defines a league object which can be used to interact with the spreadsheet
// for the given league
//------------------------------------------------------------------------------
const _ = require("lodash");
const Q = require("q");
const winston = require("winston");
const moment = require("moment");
const format = require('string-format')
format.extend(String.prototype)

const slack = require('./slack.js')
const heltour = require('./heltour.js')
const db = require("./models.js");

var MILISECOND = 1;
var SECONDS = 1000 * MILISECOND;
var MINUTES = 60 * SECONDS;
var HOURS = 60 * MINUTES;

var lichess = require("./lichess");
LEAGUE_DEFAULTS = {
    "name": "",
    "heltour": {
        "token": "",
        "baseEndpoint": "",
        "leagueTag": ""
    },
    "channels": [],
    "links": {
        "rules": "",
        "team": "",
        "lone-wolf": "",
        "guide": "",
        "captains": "",
        "registration": "",
        "source": ""
    }
};


league_attributes = {
    //--------------------------------------------------------------------------
    // A list of objects with the following attributes
    //   - username
    //   - rating
    //   - team
    //   - isCaptain
    //   - boardNumber
    //--------------------------------------------------------------------------
    _players: [],

    //--------------------------------------------------------------------------
    // A lookup from player username to a player object (from _players)
    //--------------------------------------------------------------------------
    _playerLookup: [],

    //--------------------------------------------------------------------------
    // A list of objects with the following attributes
    //   - white
    //   - black
    //   - scheduled_date (possibly undefined)
    //   - url (possibly undefined)
    //   - results (possibly undefined)
    //--------------------------------------------------------------------------
    _pairings: [],

    //--------------------------------------------------------------------------
    // A list of objects with the following attributes
    //   - name
    //   - players - A list of the players in board order
    //   - captain - A single player who is the captain
    //--------------------------------------------------------------------------
    _teams: [],

    //--------------------------------------------------------------------------
    // A lookup from a player name to their team.
    //--------------------------------------------------------------------------
    _teamLookup: {},

    //--------------------------------------------------------------------------
    // The datetime when we were last updated
    //--------------------------------------------------------------------------
    _lastUpdated: moment.utc(),

    //--------------------------------------------------------------------------
    // Canonicalize the username
    //--------------------------------------------------------------------------
    canonicalUsername: function(username) {
        username = username.split(" ")[0];
        return username.replace("*", "");
    },
    
    //--------------------------------------------------------------------------
    // Lookup a player by playerName
    //--------------------------------------------------------------------------
    getPlayer: function(username) {
        return this._playerLookup[_.toLower(username)];
    },

    canonicalUsername: function(username) {
        username = username.split(" ")[0];
        return username.replace("*", "");
    },

    //--------------------------------------------------------------------------
    // Refreshes everything
    //--------------------------------------------------------------------------
    'refresh': function() {
        var self = this;
        return Q.all([
            self.refreshRosters().then(function() {
                winston.info("Found " + self._players.length + " players for " + self.options.name);
                if (self._teams.length > 0) {
                    winston.info("Found " + self._teams.length + " teams for " + self.options.name);
                }
                self._lastUpdated = moment.utc();
            }).catch(function(error) {
                winston.error("{}: Unable to refresh rosters: {}".format(self.options.name, error));
                throw new Error(error);
            }),
            self.refreshCurrentRoundSchedules().then(function(pairings) {
                winston.info("Found " + pairings.length + " pairings for " + self.options.name);
                self._lastUpdated = moment.utc();
            }).catch(function(error) {
                winston.error("{}: Unable to refresh pairings: {}".format(self.options.name, error));
                throw new Error(error);
            })
        ]);
    },

    //--------------------------------------------------------------------------
    // Refreshes the latest roster information
    //--------------------------------------------------------------------------
    'refreshRosters': function() {
        var self = this;
        return heltour.getRoster(self.options.heltour, self.options.heltour.leagueTag).then(function(roster) {
            self._players = roster.players;
            var newPlayerLookup = {};
            var newTeams = [];
            var newLookup = {};
            roster.players.forEach(function(player) {
                newPlayerLookup[player.username.toLowerCase()] = player;
                db.lock().then(function(unlock) {
                    return db.LichessRating.findOrCreate({
                        where: { lichessUserName: player.username }
                    }).then(function(lichessRatings) {
                        lichessRating = lichessRatings[0];
                        lichessRating.set('rating', player.rating);
                        lichessRating.set('lastCheckedAt', moment.utc().format());
                        lichessRating.save().then(function() {
                            winston.info("Got updated rating from heltour for {name}: {rating}".format({
                                name: player.username,
                                rating: player.rating
                            }));
                            unlock.resolve();
                        }).catch(function(error) {
                            winston.error("{}.refreshRosters.saveRating Error: {}".format(
                                self.options.name,
                                error
                            ));
                            unlock.resolve();
                        });
                        return player.rating;
                    });
                });
            });
            self._playerLookup = newPlayerLookup;
            _.each(roster.teams, function(team) {
                _.each(team.players, function(teamPlayer) {
                    var player = self.getPlayer(teamPlayer.username);
                    player.isCaptain = player.is_captain;
                    if (player.isCaptain) {
                        team.captain = player;
                    }
                    player.boardNumber = player.board_number;
                    player.team = team;
                });
                newTeams.push(team);
                newLookup[_.toLower(team.name)] = team;
            });
            self._teams = newTeams;
            self._teamLookup = newLookup;
        });
    },

    //--------------------------------------------------------------------------
    // Figures out the current scheduling information for the round.
    //--------------------------------------------------------------------------
    'refreshCurrentRoundSchedules': function() {
        var self = this;
        return heltour.getAllPairings(self.options.heltour, self.options.heltour.leagueTag).then(function(pairings) {
            var newPairings = [];
            _.each(pairings, function(pairing) {
                var date = moment.utc(pairing.datetime);
                if (!date.isValid()) {
                    date = undefined;
                }
                // TODO: eventually we can deprecate these older attribute
                //       names, but for now I'm ok with supporting both
                pairing.datetime = pairing.date = date;
                pairing.url = pairing.game_link;
                newPairings.push(pairing);
            });
            self._pairings = newPairings;
            return self._pairings;
        });
    },

    //--------------------------------------------------------------------------
    // Finds the pairing for this current round given either a black or a white
    // username.
    //--------------------------------------------------------------------------
    'findPairing': function(white, black) {
        if (!white) {
            throw new Error("findPairing requires at least one username.");
        }
        var possibilities = this._pairings;
        function filter(playerName) {
            if (playerName) {
                possibilities = _.filter(possibilities, function(item) {
                    return (
                        item.white.toLowerCase().includes(playerName) ||
                        item.black.toLowerCase().includes(playerName)
                    );
                });
            }
        }
        filter(white);
        filter(black);
        return possibilities;
    },
    //--------------------------------------------------------------------------
    // Returns whether someone is a moderator or not.
    //--------------------------------------------------------------------------
    'isModerator': function(name) {
        return _.includes(this.options.moderators, name);
    },
    //--------------------------------------------------------------------------
    // Prepare a debug message for this league
    //--------------------------------------------------------------------------
    'formatDebugResponse': function() {
        var self = this;

        return Q.fcall(function() {
            return  'DEBUG:\nLeague: {name}\nTotal Pairings: {pairingsCount}\nLast Updated: {lastUpdated} [{since} ago]'.format({
                name: self.options.name,
                pairingsCount: self._pairings.length,
                lastUpdated: self._lastUpdated.format("YYYY-MM-DD HH:mm UTC"),
                since: self._lastUpdated.fromNow(true)
            })
        });
    },
    //--------------------------------------------------------------------------
    // Generates the appropriate data format for pairing result for this league.
    //--------------------------------------------------------------------------
    'getPairingDetails': function(targetPlayer) {
        var self = this;
        return Q.fcall(function() {
            var pairings = self.findPairing(targetPlayer.name);
            if (pairings.length < 1) {
                return {};
            }
            // TODO: determine what to do if multiple pairings are returned. ?
            pairing = pairings[0];
            var details = {
                "player": targetPlayer.name, 
                "color": "white",
                "opponent":  pairing.black,
                "date": pairing.scheduled_date
            }
            if (!_.isEqual(pairing.white.toLowerCase(), targetPlayer.name.toLowerCase())) {
                details.color = "black";
                details.opponent = pairing.white;
            }
            return details;
        }).then(function(details) {
            var deferred = Q.defer();
            if (details.opponent) {
                lichess.getPlayerRating(details.opponent).then(function(rating) {
                    details['rating'] = rating;
                    deferred.resolve(details);
                }, function(error) {
                    winston.error(JSON.stringify(error));
                    deferred.resolve(details);
                });
            } else {
                deferred.resolve({});
            }
            return deferred.promise;
        });
    },
    //--------------------------------------------------------------------------
    // Formats the pairing result for this league
    //--------------------------------------------------------------------------
    'formatPairingResponse': function(requestingPlayer, details) {
        function getRatingString(rating){
            return ( rating ? "(" + rating + ")" : "" );
        }
        var self = this;
        return Q.fcall(function() {
            var localTime;
            if (details.date) {
               localTime = requestingPlayer.localTime(details.date);
            }
            var schedule_phrase = "";
            var played_phrase = "";

            if (!localTime || !localTime.isValid()) {
                played_phrase = "will play";
                schedule_phrase = ". The game is unscheduled.";
            } else if (moment.utc().isAfter(localTime)) {
                // If the match took place in the past, display the date instead of the day
                played_phrase = "played";
                schedule_phrase = " on {localDateTimeString} in your timezone.".format({
                    localDateTimeString: localTime.format("YYYY-MM-DD [at] HH:mm")
                });
            } else {
                played_phrase = "will play";
                schedule_phrase = " on {localDateTimeString} in your timezone, which is in {timeUntil}.".format({
                    localDateTimeString: localTime.format("MM/DD _(dddd)_ [at] HH:mm"),
                    timeUntil: localTime.fromNow(true)
                })
            }

            // Otherwise display the time until the match
            return ("[{name}]: :{details.color}pieces: _{details.player}_ {played_phrase} against " +
                ":{opponent_color}pieces: _{details.opponent}_ {rating}{schedule_phrase}").format({
                    name: self.options.name,
                    details: details,
                    opponent_color: (details.color === "white" ? "black" : "white"),
                    played_phrase: played_phrase,
                    schedule_phrase: schedule_phrase,
                    rating: getRatingString(details.rating)
                });
        });
    },
    //--------------------------------------------------------------------------
    // Formats the captains Guidelines
    //--------------------------------------------------------------------------
    'formatCaptainGuidelinesResponse': function() {
        var self = this;
        return Q.fcall(function() {
            if (self.options.links && self.options.links.captains) {
                return "Here are the captain's guidelines:\n" + self.options.links.captains;
            } else {
                return "The {name} league does not have captains guidelines.".format({
                    name: self.options.name
                });
            }
        });
    },
    //--------------------------------------------------------------------------
    // Formats the pairings sheet response
    //--------------------------------------------------------------------------
    'formatPairingsLinkResponse': function() {
        var self = this;
        return Q.fcall(function() {
            if (self.options.links && self.options.links.team) {
                return "Here is the pairings/standings sheet:\n" + 
                        self.options.links.team + 
                        "\nAlternatively, try [ @chesster pairing [competitor] ]";
            } else {
                return "The {name} league does not have a pairings/standings sheet.".format({
                    name: self.options.name
                });
            }
        });
    },
    //--------------------------------------------------------------------------
    // Formats the rules link response
    //--------------------------------------------------------------------------
    'formatRulesLinkResponse': function() {
        var self = this;
        return Q.fcall(function() {
            if (self.options.links && self.options.links.rules) {
                return "Here are the rules and regulations:\n" +
                    self.options.links.rules;
            } else {
                return "The {name} league does not have a rules link.".format({
                    name: self.options.name
                });
            }
        });
    },
    //--------------------------------------------------------------------------
    // Formats the starter guide message
    //--------------------------------------------------------------------------
    'formatStarterGuideResponse': function() {
        var self = this;
        return Q.fcall(function() {
            if (self.options.links && self.options.links.guide) {
                return "Here is everything you need to know:\n" + self.options.links.guide;
            } else {
                return "The {name} league does not have a starter guide.".format({
                    name: self.options.name
                });
            }
        });
    },
    //--------------------------------------------------------------------------
    // Formats the signup response
    //--------------------------------------------------------------------------
    'formatRegistrationResponse': function() {
        var self = this;
        return Q.fcall(function() {
            if (self.options.links && self.options.links.registration) {
                return "You can sign up here:\n" + self.options.links.registration;
            } else {
                return "The {name} league does not have an active signup form at the moment.".format({
                    name: self.options.name
                });
            }
        });
    },
    //--------------------------------------------------------------------------
    // Get a list of captain names
    //--------------------------------------------------------------------------
    'getCaptains':function() {
        var self = this;
        return Q.fcall(function() {
            return _.map(self._teams, "captain");
        });
    },
    //--------------------------------------------------------------------------
    // Get the list of teams
    //--------------------------------------------------------------------------
    'getTeams':function() {
        var self = this;
        return Q.fcall(function() {
            return self._teams;
        });
    },
    //--------------------------------------------------------------------------
    // Get the team for a given player
    //--------------------------------------------------------------------------
    'getTeam':function(playerName) {
        var self = this;
        return self._teamLookup[playerName.toLowerCase()];
    },
    //--------------------------------------------------------------------------
    // Get the the players from a particular board
    //--------------------------------------------------------------------------
    'getBoard':function(boardNumber) {
        var self = this;
        return Q.fcall(function() {
            var players = [];
            _.each(self._teams, function(team) {
                if (boardNumber-1 < team.roster.length) {
                    players.push(team.roster[boardNumber-1]);
                }
            });
            return players;
        });
    },
    //--------------------------------------------------------------------------
    // Format the response for the list of captains
    //--------------------------------------------------------------------------
    'formatCaptainsResponse':function(boardNumber) {
        var self = this;
        return Q.fcall(function() {
            if (self._teams.length === 0) {
                return "The {name} league does not have captains".format({
                    name: self.options.name
                });
            }
            var message = "Team Captains:\n";
            var teamIndex = 1;
            self._teams.forEach(function(team, index, array){
                var captain = team.captain;
                if (captain) {
                    captain = captain.name;
                } else {
                    captain = "Unchosen";
                }
                message += "\t" + (teamIndex++) + ". " + team.name + ": " + captain  + "\n";
            });
            return message;
        });
    },
    //--------------------------------------------------------------------------
    // Format the response for the list of captains
    //--------------------------------------------------------------------------
    'formatTeamCaptainResponse':function(teamName) {
        var self = this;
        return Q.fcall(function() {
            if (self._teams.length === 0) {
                return "The {name} league does not have captains".format({
                    name: self.options.name
                });
            }
            teams = _.filter(self._teams, function(t) {
                return _.isEqual(t.name.toLowerCase(), teamName.toLowerCase());
            });
            if (teams.length === 0) {
                return "No team by that name";
            }
            if (teams.length > 1) {
                return "Too many teams by that name";
            }
            team = teams[0];
            if(team && team.captain){
                return "Captain of " + team.name + " is " + team.captain.name;
            }else{
                return team.name + " has not chosen a team captain. ";
            }
        });
    },
    //--------------------------------------------------------------------------
    // Format the teams response
    //--------------------------------------------------------------------------
    'formatTeamsResponse':function(teamName) {
        var self = this;
        return Q.fcall(function() {
            if (self._teams.length === 0) {
                return "The {name} league does not have teams".format({
                    name: self.options.name
                });
            }
            var message = "There are currently " + self._teams.length + " teams competing. \n";
            var teamIndex = 1;
            self._teams.forEach(function(team, index, array){
                message += "\t" + (teamIndex++) + ". " + team.name + "\n";
            });
            return message;
        });
    },
    //--------------------------------------------------------------------------
    // Format board response
    //--------------------------------------------------------------------------
    'formatBoardResponse': function(boardNumber) {
        var self = this;
        return Q.fcall(function() {
            if (self._teams.length === 0) {
                return "The {name} league does not have teams".format({
                    name: self.options.name
                });
            }
            return self.getBoard(boardNumber).then(function(players) {
                var message = "Board " + boardNumber + " consists of... \n";
                players.sort(function(e1, e2){
                    return e1.rating > e2.rating ? -1 : e1.rating < e2.rating ? 1 : 0;
                });
                players.forEach(function(member, index, array){
                    message += "\t" + member.name + ": (Rating: " + member.rating + "; Team: " + member.team.name + ")\n";
                });
                return message;
            });
        });
    },
    //--------------------------------------------------------------------------
    // Format team members response
    //--------------------------------------------------------------------------
    'formatTeamMembersResponse': function(teamName) {
        var self = this;
        return Q.fcall(function() {
            if (self._teams.length === 0) {
                return "The {name} league does not have teams".format({
                    name: self.options.name
                });
            }
            teams = _.filter(self._teams, function(t) {
                return _.isEqual(t.name.toLowerCase(), teamName.toLowerCase())
            });
            if (teams.length === 0) {
                return "No team by that name";
            }
            if (teams.length > 1) {
                return "Too many teams by that name";
            }
            team = teams[0];
            var message = "The members of " + team.name + " are \n";
            team.roster.forEach(function(member, index, array){
                message += "\tBoard " + (index+1) + ": " + member.name + " (" + member.rating + ")\n";
            });
            return message;
        });
    },
    //--------------------------------------------------------------------------
    // Format the mods message
    //--------------------------------------------------------------------------
    'formatModsResponse': function() {
        var self = this;
        moderators = _.map(self.options.moderators, function(name) {
            return name[0] + "\u200B" + name.slice(1);
        });
        return Q.fcall(function() {
            return ("{0} mods: " + moderators.join(", ")).format(self.options.name);
        });
    },
    //--------------------------------------------------------------------------
    // Format the summon mods message
    //--------------------------------------------------------------------------
    'formatSummonModsResponse': function() {
        var self = this;
        moderators = _.map(self.options.moderators, function(name) {
            return slack.users.getIdString(name);
        });
        return Q.fcall(function() {
            return ("{0} mods: " + moderators.join(", ")).format(self.options.name);
        });
    }
};

function League(options) {
    this.options = {};
    _.extend(this.options, LEAGUE_DEFAULTS, options || {});
    _.extend(this, league_attributes);
}

function getAllLeagues(config) {
    var all_league_configs = config['leagues'] || {};
    return _(all_league_configs)
        .keys()
        .map(function(key) {
            return getLeague(key, config);
        })
        .value();
}

var getLeague = (function() {
    var _league_cache = {};
    return function (league_name, config) {

        if(!_league_cache[league_name]) {
            // Else create it if there is a config for it.
            var all_league_configs = config['leagues'] || {};
            var this_league_config = all_league_configs[league_name] || undefined;
            if (this_league_config) {
                winston.info("Creating new league for " + league_name);
                this_league_config = _.clone(this_league_config);
                this_league_config.name = league_name;
                league = new League(this_league_config);
                _league_cache[league_name] = league;
            } else {
                return undefined;
            }
        }
        return _league_cache[league_name];
    }
}());

module.exports.League = League;
module.exports.getLeague = getLeague;
module.exports.getAllLeagues = getAllLeagues;
