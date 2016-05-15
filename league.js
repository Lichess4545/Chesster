//------------------------------------------------------------------------------
// Defines a league object which can be used to interact with the spreadsheet
// for the given league
//------------------------------------------------------------------------------
// TODO: create a lichess object that does the same thing for lichess data.
// TODO: create a set of slack helpers that map channel names to a
// specific league object, so that the code for scheduling, results or
// gamelinks 
var _ = require("underscore");
var spreadsheets = require("./spreadsheets");
var moment = require("moment");
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
    // Canonicallized the username
    //--------------------------------------------------------------------------
    canonical_username: function(username) {
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
        });
        self.refreshRosters(function(err, rosters) {
            if (err) {
                console.error("Unable to refresh rosters: " + err);
                throw new Error(err);
            } else {
                console.log("Found " + rosters.length + " teams for " + self.options.name);
            }
        });
        self.refreshCurrentRoundSchedules(function(err, pairings) {
            if (err) {
                console.error("Unable to refresh schedule: " + err);
                throw new Error(err);
            } else {
                console.log("Found " + pairings.length + " pairings for " + self.options.name);
            }
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
                    var link = spreadsheets.parse_hyperlink(row['result'].formula || "");
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
        console.log(white, black);
        white = white || undefined;
        if (!white) {
            throw new Error("findPairing requires at least one username.");
        }
        black = black || undefined;
        var possibilities = this._pairings;
        console.log(possibilities.length);
        if (white) {
            possibilities = _.filter(possibilities, function(item) {
                return (
                    item.white.toLowerCase().includes(white) ||
                    item.black.toLowerCase().includes(white)
                );
            });

        }
        console.log(possibilities.length);
        if (black) {
            possibilities = _.filter(possibilities, function(item) {
                return (
                    item.white.toLowerCase().includes(black) ||
                    item.black.toLowerCase().includes(black)
                );
            });
        }
        console.log(possibilities.length);
        return possibilities;
    },

};

function League(options) {
    this.options = {};
    _.extend(this.options, LEAGUE_DEFAULTS, options || {});
    _.extend(this, league_attributes);
};

function getLeague(league_name, config) {
    this._cache = ( this._cache ? this._cache : {} );

    if(!this._cache[league_name]) {
        // Else create it if there is a config for it.
        var league_options = config[league_name] || undefined;
        if (league_options) {
            console.log("Creating new league for " + league_name);
            league_options = _.clone(league_options);
            league_options.name = league_name;
            league = new League(league_options);
            this._cache[league_name] = league;
        } else {
            console.log("Couldn't find options for " + league_name + " league. Not creating object.");
        }
    }
    return this._cache[league_name];
}

module.exports.League = League;
module.exports.getLeague = getLeague;
