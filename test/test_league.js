var assert = require('chai').assert;
var Q = require("q");
var _ = require("underscore");
var moment = require("moment");
var league = require('../league');


// NOTE: this file is required, but not provided in the repository.
var private_key = require("../test_service_account_key.js").key;
var _45_45_LEAGUE_CONF = {
    "name": "45+45",
    "spreadsheet": {
        "key": "1BeRN76zaB_uCCrCra2yTEEw_r6C5_b8P59aN_BrJsyA",
        "service_account_auth": {
            "client_email": "tesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
            "private_key": private_key
        },
        "schedule_colname": "time (mm/dd @ hh:mm*)"
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

describe('league', function() {
    //--------------------------------------------------------------------------
    describe('after refreshCurrentRoundSchedules', function () {
        _45_league = new league.League(_45_45_LEAGUE_CONF);
        before(function(done) {
            this.timeout(5000);
            _45_league.refreshCurrentRoundSchedules(function(err, pairings) {
                done();
            });
        });
        it("Testing refreshCurrentRoundSchedules()", function() {
            // Normally I would split this test out into multiples,
            // but this is slow enough that I want to test everything at this
            // point.
            // Ensure we got the right amount of pairings
            assert.equal(_45_league._pairings.length, 78);

            // Ensure that the first pairing is what we expect
            var first_pairing = _45_league._pairings[0];
            assert.equal(first_pairing.white.toLowerCase(), "steiger07");
            assert.equal(first_pairing.black.toLowerCase(), "toddle");
            assert.equal(first_pairing.scheduled_date.format("MM/DD @ HH:mm"), "04/14 @ 16:00");
            assert.equal(first_pairing.result, "1-0");
            assert.equal(first_pairing.url, "http://en.lichess.org/FwYcks48");

            // Ensure that the second pairing is what we expect.
            var second_pairing = _45_league._pairings[1];
            assert.equal(second_pairing.white.toLowerCase(), "felixnl");
            assert.equal(second_pairing.black.toLowerCase(), "r-mena");
            assert.equal(second_pairing.scheduled_date.format("MM/DD @ HH:mm"), "04/17 @ 21:00");
            assert.equal(second_pairing.result, "");

        });
        it("test findPairing", function() {
            // Ensure that we can find pairings by username now.
            function testPairings(pairings) {
                assert.equal(pairings.length, 1);
                var pairing = pairings[0];
                assert.equal(pairing.white, "lakinwecker");
                assert.equal(pairing.black, "osskjc");
            }

            testPairings(_45_league.findPairing("lakinwecker"));
            testPairings(_45_league.findPairing("osskjc"));
            testPairings(_45_league.findPairing("lakinwecker", "osskjc"));
        });
        it("test getPairingDetails", function(done) {
            var promises = [];
            promises.push(_45_league.getPairingDetails({'name': "made-up"}).then(
                function(details) {
                    assert.equal(true, _.isEqual({}, details));
                }
            ));
            promises.push(_45_league.getPairingDetails({'name': "lakinwecker"}).then(
                function(details) {
                    assert.equal(details.opponent, "osskjc");
                    assert.equal(details.color, "white");
                    assert.equal(details.rating > 0, true);
                    assert.equal(details.date.format("YYYY-MM-DD HH:mm"), "2016-04-25 10:30");
                }
            ));
            promises.push(_45_league.getPairingDetails({'name': "jughandle10"}).then(
                function(details) {
                    assert.equal(details.opponent, "Cynosure");
                    assert.equal(details.color, "black");
                    assert.equal(details.date, undefined);
                }
            ));

            return Q.all(promises).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
        it("test formatPairingDetails", function(done) {
            var requestingPlayer = {
                name: "lakinwecker",
                localTime: function(d) { return d; }
            };
            var common_details = {
                player: "lakinwecker",
                opponent: "osskjc",
                rating: 1776,
                color: "white",
                date: undefined
            };
            Q.all([
                _45_league.formatPairingDetails(
                    requestingPlayer,
                    _.extend({}, common_details)
                ).then(function(message) {
                    assert.equal(
                        message,
                        "[45+45]: lakinwecker will play as white against osskjc (1776). The game is unscheduled."
                    );
                }),
                _45_league.formatPairingDetails(
                    requestingPlayer,
                    _.extend({}, common_details, {date: moment.utc("2016-04-25 17:00")})
                ).then(function(message) {
                    assert.equal(
                        message,
                        "[45+45]: lakinwecker played as white against osskjc (1776) on 04/25 at 17:00."
                    );
                }),
                _45_league.formatPairingDetails(
                    requestingPlayer,
                    _.extend({}, common_details, {date: moment.utc().add(1, "day")})
                ).then(function(message) {
                    var date = moment.utc().add(1, "day");
                    date = date.format("MM/DD [at] HH:mm");
                    assert.equal(
                        message,
                        "[45+45]: lakinwecker will play as white against osskjc (1776) on " + date  + " which is in a day"
                    );
                })
            ]).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
    });
});
