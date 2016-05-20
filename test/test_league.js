var assert = require('chai').assert;
var Q = require("q");
var _ = require("underscore");
var moment = require("moment");
var league = require('../league');


// NOTE: this file is required, but not provided in the repository.
var private_key = require("../service_account_key.js").key;
var _45_45_LEAGUE_CONF = {
    "spreadsheet": {
        "key": "1BeRN76zaB_uCCrCra2yTEEw_r6C5_b8P59aN_BrJsyA",
        "service_account_auth": {
            "client_email": "chesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
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
        it("Testing stuff that needs refreshCurrentRoundSchedules()", function(done) {
            var promises = [];
            this.timeout(15000);
            // Normally I would split this test out into multiples,
            // but this is slow enough that I want to test everything at this
            // point.
            _45_league = new league.League(_45_45_LEAGUE_CONF);
            _45_league.refreshCurrentRoundSchedules(function(err, pairings) {
                // Ensure we got the right amount of pairings
                assert.equal(pairings.length, 78);


                // Ensure that the first pairing is what we expect
                var first_pairing = pairings[0];
                assert.equal(first_pairing.white.toLowerCase(), "steiger07");
                assert.equal(first_pairing.black.toLowerCase(), "toddle");
                assert.equal(first_pairing.scheduled_date.format("MM/DD @ HH:mm"), "04/14 @ 16:00");
                assert.equal(first_pairing.result, "1-0");
                assert.equal(first_pairing.url, "http://en.lichess.org/FwYcks48");

                // Ensure that the second pairing is what we expect.
                var second_pairing = pairings[1];
                assert.equal(second_pairing.white.toLowerCase(), "felixnl");
                assert.equal(second_pairing.black.toLowerCase(), "r-mena");
                assert.equal(second_pairing.scheduled_date.format("MM/DD @ HH:mm"), "04/17 @ 21:00");
                assert.equal(second_pairing.result, "");


                // Ensure that we can find pairings by username now.
                function test_pairings(pairings) {
                    assert.equal(pairings.length, 1);
                    var pairing = pairings[0];
                    assert.equal(pairing.white, "lakinwecker");
                    assert.equal(pairing.black, "osskjc");
                }

                test_pairings(_45_league.findPairing("lakinwecker"));
                test_pairings(_45_league.findPairing("osskjc"));
                test_pairings(_45_league.findPairing("lakinwecker", "osskjc"));

                var test_cases_run = 0;
                promises.push(_45_league.getPairingDetails({'name': "made-up"}).then(
                    function(details) {
                        ++test_cases_run;
                        assert.equal(true, _.isEqual({}, details));
                    }
                ));
                promises.push(_45_league.getPairingDetails({'name': "lakinwecker"}).then(
                    function(details) {
                        ++test_cases_run;
                        assert.equal(details.opponent, "osskjc");
                        assert.equal(details.color, "white");
                        assert.equal(details.date.format("YYYY-MM-DD HH:mm"), "2016-04-25 10:30");
                    }
                ));
                promises.push(_45_league.getPairingDetails({'name': "jughandle10"}).then(
                    function(details) {
                        ++test_cases_run;
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
        });
    });
});
