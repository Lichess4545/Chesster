//------------------------------------------------------------------------------
// Defines a league object which can be used to interact with the spreadsheet
// for the given league
//------------------------------------------------------------------------------
// TODO: create a set of slack helpers that map channel names to a
// specific league object, so that the code for scheduling, results or
// gamelinks 
var _ = require("underscore");
var Q = require("q");
var moment = require("moment");
var format = require('string-format')
format.extend(String.prototype)

var spreadsheets = require("./spreadsheets");
var lichess = require("./lichess");
LEAGUE_DEFAULTS = {
    "name": "",
    "spreadsheet": {
        "key": "",
        "service_account_auth": {
            "client_email": "",
            "private_key": ""
        },
        "schedule_colname": ""
    },
    "channels": [],
    "links": {
        "rules": "",
        "team": "",
        "lone-wolf": "",
        "guide": "",
        "captains": "",
        "registration": "",
        "source": "",
    }
};


league_attributes = {
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
    // The datetime when we were last updated
    //--------------------------------------------------------------------------
    _lastUpdated: moment.utc(),

    //--------------------------------------------------------------------------
    // Canonicalize the username
    //--------------------------------------------------------------------------
    canonical_username: function(username) {
        username = username.split(" ")[0];
        return username.replace("*", "");
    },

    //--------------------------------------------------------------------------
    // Refreshes everything
    //--------------------------------------------------------------------------
    'refresh': function() {
        var self = this;
        self.refreshMods(function(err, mods) {
            if (err) {
                console.error("Unable to refresh mods: " + err);
                throw new Error(err);
            } else {
                console.log("Found " + mods.length + " mods for " + self.options.name);
            }
            self._lastUpdated = moment.utc();
        });
        self.refreshRosters(function(err, rosters) {
            if (err) {
                console.error("Unable to refresh rosters: " + err);
                throw new Error(err);
            } else {
                console.log("Found " + rosters.length + " teams for " + self.options.name);
            }
            self._lastUpdated = moment.utc();
        });
        self.refreshCurrentRoundSchedules(function(err, pairings) {
            if (err) {
                console.error("Unable to refresh schedule: " + err);
                throw new Error(err);
            } else {
                console.log("Found " + pairings.length + " pairings for " + self.options.name);
            }
            self._lastUpdated = moment.utc();
        });
    },

    //--------------------------------------------------------------------------
    // Refreshes the latest roster information
    //--------------------------------------------------------------------------
    'refreshRosters': function(callback) {
    },

    //--------------------------------------------------------------------------
    // Refreshes the latest mods information
    //--------------------------------------------------------------------------
    'refreshMods': function(callback) {
    },

    //--------------------------------------------------------------------------
    // Figures out the current scheduling information for the round.
    //--------------------------------------------------------------------------
    'refreshCurrentRoundSchedules': function(callback) {
        var query_options = {
            'min-row': 1,
            'max-row': 100,
            'min-col': 1,
            'max-col': 8,
            'return-empty': true
        }
        var self = this;
        spreadsheets.get_rows(
            self.options.spreadsheet.service_account_auth,
            self.options.spreadsheet.key,
            query_options,
            function(err, rows) {
                if (err) { return callback(err, rows); }
                var new_pairings = [];
                rows.forEach(function(row) {
                    if (!row['white'].value || !row['black'].value) { return; }
                    if (row['result'].formula) {
                        var link = spreadsheets.parse_hyperlink(row['result'].formula || "");
                    } else {
                        var link = {'text': row['result'].value};
                    }
                    var date_string = row[self.options.spreadsheet.schedule_colname].value || '';
                    date_string = date_string.trim()
                    var date = moment.utc(
                        moment.utc().year() + "/" + date_string,
                        "YYYY/MM/DD @ HH:mm",
                        true
                    );
                    if (!date.isValid()) {
                        date = undefined;
                    }
                    new_pairings.push({
                        white: self.canonical_username(row['white'].value),
                        black: self.canonical_username(row['black'].value),
                        result: link['text'],
                        url: link['href'],
                        scheduled_date: date
                    });
                });
                self._pairings = new_pairings;
                callback(undefined, self._pairings);
            }
        );
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
        };
        filter(white);
        filter(black);
        return possibilities;
    },
    //--------------------------------------------------------------------------
    // Prepare a debug message for this league
    //--------------------------------------------------------------------------
    'debugMessage': function() {
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
            if (pairing.white.toLowerCase() != targetPlayer.name.toLowerCase()) {
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
                    console.error(JSON.stringify(error));
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
            return ( rating ? " (" + rating + ")" : "" );
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
                played_phrase = "will play as";
                schedule_phrase = ". The game is unscheduled.";
            } else if (moment.utc().isAfter(localTime)) {
                // If the match took place in the past, display the date instead of the day
                played_phrase = "played as";
                schedule_phrase = " on {localDateTimeString}.".format({
                    localDateTimeString: localTime.format("MM/DD [at] HH:mm")
                });
            } else {
                played_phrase = "will play as";
                schedule_phrase = " on {localDateTimeString} which is in {timeUntil}".format({
                    localDateTimeString: localTime.format("MM/DD [at] HH:mm"),
                    timeUntil: localTime.fromNow(true)
                })
            }

            // Otherwise display the time until the match
            return "[{name}]: {details.player} {played_phrase} {details.color} against {details.opponent}{rating}{schedule_phrase}".format({
                name: self.options.name,
                details: details,
                played_phrase: played_phrase,
                schedule_phrase: schedule_phrase,
                rating: getRatingString(details.rating),
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
    }
};

function League(options) {
    this.options = {};
    _.extend(this.options, LEAGUE_DEFAULTS, options || {});
    _.extend(this, league_attributes);
};

function getAllLeagues(config) {
    var leagues = [];
    var all_league_configs = config['leagues'] || {};
    _.each(_.keys(all_league_configs), function(key) {
        leagues.push(getLeague(key, config));
    });
    return leagues;
}

var getLeague = (function() {
    var _league_cache = {};
    return function (league_name, config) {

        if(!_league_cache[league_name]) {
            // Else create it if there is a config for it.
            var all_league_configs = config['leagues'] || {};
            var this_league_config = all_league_configs[league_name] || undefined;
            if (this_league_config) {
                console.log("Creating new league for " + league_name);
                this_league_config = _.clone(this_league_config);
                this_league_config.name = league_name;
                league = new League(this_league_config);
                _league_cache[league_name] = league;
            } else {
                console.log("Couldn't find options for " + league_name + " league. Not creating object.");
                return undefined;
            }
        }
        return _league_cache[league_name];
    }
})();

module.exports.League = League;
module.exports.getLeague = getLeague;
module.exports.getAllLeagues = getAllLeagues;
