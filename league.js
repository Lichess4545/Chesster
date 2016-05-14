//------------------------------------------------------------------------------
// Defines a league object which can be used to interact with the spreadsheet
// for the given league
//------------------------------------------------------------------------------
var _ = require("underscore");
var spreadsheets = require("./spreadsheets");
var moment = require("moment");
LEAGUE_DEFAULTS = {
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
    // Syncs the latest team information
    //--------------------------------------------------------------------------
    'get_rosters': function(callback) {
    },

    //--------------------------------------------------------------------------
    // Figures out who the mods are
    //--------------------------------------------------------------------------
    'get_mods': function(callback) {
    },

    //--------------------------------------------------------------------------
    // Finds the pairing for this current round given either a black or a white
    // username.
    //--------------------------------------------------------------------------
    'findPairing': function(white, black) {
        white = white || undefined;
        if (!white) {
            throw new Error("findPairing requires at least one username.");
        }
        black = black || undefined;
        var possibilities = this._pairings;
        if (white) {
            possibilities = _.filter(possibilities, function(item) {
                return (
                    item.white.toLowerCase().includes(white) ||
                    item.black.toLowerCase().includes(white)
                );
            });

        }
        if (black) {
            possibilities = _.filter(possibilities, function(item) {
                return (
                    item.white.toLowerCase().includes(black) ||
                    item.black.toLowerCase().includes(black)
                );
            });
        }
        return possibilities;
    },

    //--------------------------------------------------------------------------
    // Figures out the current scheduling information for the round.
    //--------------------------------------------------------------------------
    'getCurrentRoundSchedule': function(callback) {
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
    }
};

function League(options) {
    this.options = {};
    _.extend(this.options, LEAGUE_DEFAULTS, options || {});
    _.extend(this, league_attributes);
};

var _cache = {};
function getLeague(league_name, config) {
    // If we already created it, return it.
    var league = _cache[league_name];
    if (league) return league;
    console.log(league_name);

    // Else create it if there is a config for it.
    var league_options = config[league_name] || undefined;
    if (league_options) {
        league = new League(league_options);
        _cache[league_name] = league;
        return league;
    }
    console.log("Couldn't find options for " + league_name + " league. Not creating object.");
    return undefined;
}

module.exports.League = League;
module.exports.getLeague = getLeague;
