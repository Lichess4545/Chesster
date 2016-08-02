var assert = require('chai').assert;
var Q = require("q");
var _ = require("lodash");
var moment = require("moment");
var league = require('../src/league');
var lichess = require('../src/lichess');
var slack = require('../src/slack');

var _45_45_LEAGUE_CONF = {
    "name": "45+45",
    "spreadsheet": {
        "key": "1BeRN76zaB_uCCrCra2yTEEw_r6C5_b8P59aN_BrJsyA",
        "serviceAccountAuth": undefined,
        "scheduleColname": "time (mm/dd @ hh:mm*)"
    },
    "moderators": ['endrawes0', 'theino', 'mrlegilimens'],
    "channels": [],
    "links": {
        "rules": "",
        "team": "",
        "lone-wolf": "",
        "guide": "",
        "captains": "",
        "registration": "",
        "source": ""
    },
    "scheduling": {
        "format": "MM/DD @ HH:mm"
    }
};


// NOTE: this key is required for the write tests, but not provided in the repository.
var private_key = null
try {
    private_key = require("../config/test_service_account_key.js").key;
} catch (e) {
    if (process.env.TEST_SERVICE_ACCOUNT_KEY) {
        private_key = process.env.TEST_SERVICE_ACCOUNT_KEY.split("\\n").join("\n");
    }
}
if (private_key) {
    _45_45_LEAGUE_CONF["spreadsheet"]["serviceAccountAuth"] = {
        "client_email": "tesster@chesster-lichess-4545-bot.iam.gserviceaccount.com",
        "private_key": private_key
    }
}

describe('league', function() {
    //--------------------------------------------------------------------------
    describe('testing league functionality', function () {
        _45_league = new league.League(_45_45_LEAGUE_CONF);
        var oldGetPlayerRating = null;
        before(function(done) {
            this.timeout(30000);
            oldGetPlayerRating = lichess.getPlayerRating;
            lichess.getPlayerRating = function(name) {
                return Q.fcall(function() {
                    return 1500;
                });
            };
            _45_league.refreshCurrentRoundSchedules(function(err, pairings) {
                _45_league.refreshRosters(function(err, teams) {
                    done();
                });
            });
        });
        after(function() {
            lichess.getPlayerRating = oldGetPlayerRating;
        });
        it("Testing refreshCurrentRoundSchedules()", function() {
            // Normally I would split this test out into multiples,
            // but this is slow enough that I want to test everything at this
            // point.
            // Ensure we got the right amount of pairings
            assert.equal(_45_league._pairings.length, 78);

            // Ensure that the first pairing is what we expect
            var first_pairing = _45_league._pairings[0];
            assert.equal(first_pairing.white.toLowerCase(), "thephobia");
            assert.equal(first_pairing.black.toLowerCase(), "sirdore");
            assert.equal(first_pairing.scheduled_date.format("MM/DD @ HH:mm"), "04/14 @ 16:00");
            assert.equal(first_pairing.result, "1/2-1/2");

            // Ensure that the second pairing is what we expect.
            var second_pairing = _45_league._pairings[1];
            assert.equal(second_pairing.white.toLowerCase(), "felixnl");
            assert.equal(second_pairing.black.toLowerCase(), "r-mena");
            assert.equal(second_pairing.scheduled_date.format(_45_league.options.scheduling.format), "04/17 @ 21:00");
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
            this.timeout(5000);
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
                    assert.equal(details.date.format("YYYY-MM-DD HH:mm"), "2016-06-07 15:00");
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
        it("test formatPairingResponse", function(done) {
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
                _45_league.formatPairingResponse(
                    requestingPlayer,
                    _.extend({}, common_details)
                ).then(function(message) {
                    assert.equal(
                        message,
                        "[45+45]: lakinwecker will play as white against osskjc (1776). The game is unscheduled."
                    );
                }),
                _45_league.formatPairingResponse(
                    requestingPlayer,
                    _.extend({}, common_details, {date: moment.utc("2016-04-25 17:00")})
                ).then(function(message) {
                    assert.equal(
                        message,
                        "[45+45]: lakinwecker played as white against osskjc (1776) on 04/25 at 17:00."
                    );
                }),
                _45_league.formatPairingResponse(
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
        function testPairingsHaveURLS() {
            var first_pairing = _45_league._pairings[0];
            assert.equal(first_pairing.result, "1/2-1/2");
            assert.equal(first_pairing.url, "http://en.lichess.org/rBrDnjTn");
        };
        if (private_key) {
            it("test that we are getting the urls in the pairings", testPairingsHaveURLS);
        } else {
            it.skip("test that we are getting the urls in the pairings", testPairingsHaveURLS);
        }
        it("Testing refreshRosters", function() {
            assert.equal(_45_league._teams.length, 26);
        });
        it("Testing getPlayer", function() {
            var player = _45_league.getPlayer("lakinwecker");
            assert.equal(player.name, "lakinwecker");
            assert.equal(player.board, 5);
            assert.equal(player.team.name, "The Stale Maids");
        });
        it("Testing getCaptains()", function() {
            return _45_league.getCaptains().then(function(captains) {
                captains = _.map(captains, function(c) { return c.name; });
                var expectedCaptains = [
                    'alexmdaniel',
                    'Toperoco',
                    'elwood_',
                    'jivey',
                    'NonMasterAlex',
                    'Matuiss2',
                    'ghostologist',
                    'cyanfish',
                    'Sonata2',
                    'arlberg',
                    'iebrian',
                    'hillrp',
                    'Bloodyfox',
                    'Jyr',
                    'EsolcNeveton',
                    'CaptNCarter',
                    'tnan123',
                    'riemannn',
                    'Seb32',
                    'Felixnl',
                    'quirked',
                    'thephobia',
                    'kirschwasser',
                    'gnarlygoat',
                    'Mooserohde',
                    'Dialh'
                ];
                assert.equal(captains.length, expectedCaptains.length);
                var diff = _.difference(captains, expectedCaptains);
                assert.equal(0, diff.length);
            });
        });
        it("Testing getBoard(1)", function() {
            return _45_league.getBoard(1).then(function(players) {
                players = _.map(players, function(p) { return p.name; });
                var expectedPlayers = [
                    'andyquibler',
                    'Pawnprecaution',
                    'Atrophied',
                    'Pitrinu',
                    'Shammies',
                    'Matuiss2',
                    'SuperVJ',
                    'cyanfish',
                    'Sonata2',
                    'Sjaart',
                    'crabbypat',
                    'Hyzer',
                    'Bloodyfox',
                    'Jyr',
                    'Steiger07',
                    'theino',
                    'ecstaticbroccoli',
                    'mhavgar',
                    'sangan',
                    'Toddle',
                    'eamonmont',
                    'Kobol',
                    'resonantpillow',
                    'gnarlygoat',
                    'Doganof',
                    'Pasternak'
                ];
                assert.equal(players.length, expectedPlayers.length);
                var diff = _.difference(expectedPlayers, l=players);
                assert.equal(0, diff.length);
            });
        });
        it("Testing getBoard(2)", function() {
            return _45_league.getBoard(2).then(function(players) {
                players = _.map(players, function(p) { return p.name; });
                var expectedPlayers = [
                    'ventricule',
                    'Toperoco',
                    'elwood_',
                    'kimaga',
                    'brwnbr',
                    'somethingpretentious',
                    'Questoguy',
                    'DannyKong',
                    'Practicedave',
                    'jughandle10',
                    'ihateRBF',
                    'MorallyGray',
                    'Cynosure',
                    'HoxHound',
                    'R-Mena',
                    'CaptNCarter',
                    'dgees',
                    'Knoddel',
                    'droodjerky',
                    'Felixnl',
                    'quirked',
                    'Toj',
                    'metalpawn',
                    'JPTriton',
                    'Jimmyd7777',
                    'flamehead'
                ];
                assert.equal(players.length, expectedPlayers.length);
                var diff = _.difference(expectedPlayers, players);
                assert.equal(0, diff.length);
            });
        });
        it("Testing getBoard(3)", function() {
            return _45_league.getBoard(3).then(function(players) {
                players = _.map(players, function(p) { return p.name; });
                var expectedPlayers = [
                    'modakshantanu',
                    'super_sanic',
                    'vishysoisse',
                    'llimllib',
                    'NonMasterAlex',
                    'jaivl',
                    'AshkanJah',
                    'ForkerofQueens',
                    'shetoo',
                    'arlberg',
                    'MrIan15',
                    'krzem',
                    'Revoof',
                    'kingscrusher-fan',
                    'jmaltby',
                    'Orgsalsa',
                    'ebb1',
                    'riemannn',
                    'redhoax',
                    'MrLegilimens',
                    'Diamanthori',
                    'juldiaz280992',
                    'DurchNachtUndWind',
                    'Unihedron',
                    'Philgood84',
                    'Tom_kg'
                ];
                assert.equal(players.length, expectedPlayers.length);
                var diff = _.difference(expectedPlayers, players);
                assert.equal(0, diff.length);
            });
        });
        it("Testing getBoard(4)", function() {
            return _45_league.getBoard(4).then(function(players) {
                players = _.map(players, function(p) { return p.name; });
                var expectedPlayers = [
                    'alexmdaniel',
                    'linail',
                    'iedopadzert',
                    'mkoga',
                    'egocrusher',
                    'scarff',
                    'MRSep',
                    'tylerc0816',
                    'scottm91',
                    'ctorh',
                    'iebrian',
                    'jagvillspelaschack',
                    'RuizBR',
                    'Anunzio',
                    'EsolcNeveton',
                    'sigvei',
                    'bramminator',
                    'explodingllama',
                    'Cheesehead04',
                    'mfink1',
                    'infested',
                    'narud',
                    'kirschwasser',
                    'dooje',
                    'Nubas',
                    'nacional100'
                ];
                assert.equal(players.length, expectedPlayers.length);
                var diff = _.difference(expectedPlayers, players);
                assert.equal(0, diff.length);
            });
        });
        it("Testing getBoard(5)", function() {
            return _45_league.getBoard(5).then(function(players) {
                players = _.map(players, function(p) { return p.name; });
                var expectedPlayers = [
                    'CarlosMagnussen',
                    'GreyHawk',
                    'n4zgul',
                    'jivey',
                    'shafdanny',
                    'ca7alyst81',
                    'BamaBeeblebrox',
                    'djcrisce',
                    'Prune2000',
                    'DiscoverChex',
                    'jshholland',
                    'hillrp',
                    'lukhas',
                    'agrav123',
                    'lakinwecker',
                    'jacobhess',
                    'tnan123',
                    'daveyjones01',
                    'Seb32',
                    'osskjc',
                    'mbazylisk',
                    'thephobia',
                    'Braffin',
                    'darobertson',
                    'Mooserohde',
                    'rwill128'
                ];
                assert.equal(players.length, expectedPlayers.length);
                var diff = _.difference(expectedPlayers, players);
                assert.equal(0, diff.length);
            });
        });
        it("Testing getBoard(6)", function() {
            return _45_league.getBoard(6).then(function(players) {
                players = _.map(players, function(p) { return p.name; });
                var expectedPlayers = [
                    'saschlars',
                    'festivus',
                    'greg-butts',
                    'amacy',
                    'stoy',
                    'Immortality',
                    'ghostologist',
                    'JuanSnow',
                    'abdelaziz_sayed',
                    'angborxley',
                    'Petruchio',
                    'adamroyd',
                    'eljefe08',
                    'Pawnpunter',
                    'Hkivrak',
                    'endrawes0',
                    'OldTom',
                    'Elixr',
                    'Thetasquared',
                    'TheKnug',
                    'SirDore',
                    'tworivers',
                    'ChukoDiman',
                    'FradtheImpaler',
                    'tothe6thpower',
                    'Dialh'
                ];
                assert.equal(players.length, expectedPlayers.length);
                var diff = _.difference(expectedPlayers, players);
                assert.equal(0, diff.length);
            });
        });
        it("test formatCaptainsResponse", function() {
            return _45_league.formatCaptainsResponse().then(function(message) {
                assert.equal(
                    message,
                    "Team Captains:\n" +
                    "\t1. ¡No en-pasarán!: alexmdaniel\n" +
                    "\t2. Sac's on the Beach: Toperoco\n" +
                    "\t3. Icy Tactics: elwood_\n" +
                    "\t4. The Zugzwang Clan: jivey\n" +
                    "\t5. Magnus Opus: NonMasterAlex\n" +
                    "\t6. Sicilian Dragons: Matuiss2\n" +
                    "\t7. Sac' Up: ghostologist\n" +
                    "\t8. No Pawn Intended: cyanfish\n" +
                    "\t9. Highway Karjaking: Sonata2\n" +
                    "\t10. All Knight Dance Party: arlberg\n" +
                    "\t11. Knights Who Say 'Nf3': iebrian\n" +
                    "\t12. Legalize Caruana: hillrp\n" +
                    "\t13. Team N/A: Bloodyfox\n" +
                    "\t14. Disco Dancers: Jyr\n" +
                    "\t15. The Stale Maids: EsolcNeveton\n" +
                    "\t16. W.I.N.N.E.R.S.: CaptNCarter\n" +
                    "\t17. Pawnbrokers: tnan123\n" +
                    "\t18. Zugzwangers: riemannn\n" +
                    "\t19. It's a Blunderful Life: Seb32\n" +
                    "\t20. Lemons and Lines: Felixnl\n" +
                    "\t21. Smack My Bishop: quirked\n" +
                    "\t22. Catch-22: thephobia\n" +
                    "\t23. Regicide: kirschwasser\n" +
                    "\t24. f8/Stay Knights: gnarlygoat\n" +
                    "\t25. Promote to Pawn: Mooserohde\n" +
                    "\t26. Chess Mates: Dialh\n"
                );
            })
        });
        it("test formatTeamCaptainResponse", function() {
            return _45_league.formatTeamCaptainResponse("The Stale Maids").then(function(message) {
                assert.equal(
                    message,
                    "Captain of The Stale Maids is EsolcNeveton"
                );
            })
        });
        it("test formatTeamsResponse", function() {
            return _45_league.formatTeamsResponse().then(function(message) {
                assert.equal(
                    message,
                    "There are currently 26 teams competing. \n" +
                    "\t1. ¡No en-pasarán!\n" +
                    "\t2. Sac's on the Beach\n" +
                    "\t3. Icy Tactics\n" +
                    "\t4. The Zugzwang Clan\n" +
                    "\t5. Magnus Opus\n" +
                    "\t6. Sicilian Dragons\n" +
                    "\t7. Sac' Up\n" +
                    "\t8. No Pawn Intended\n" +
                    "\t9. Highway Karjaking\n" +
                    "\t10. All Knight Dance Party\n" +
                    "\t11. Knights Who Say 'Nf3'\n" +
                    "\t12. Legalize Caruana\n" +
                    "\t13. Team N/A\n" +
                    "\t14. Disco Dancers\n" +
                    "\t15. The Stale Maids\n" +
                    "\t16. W.I.N.N.E.R.S.\n" +
                    "\t17. Pawnbrokers\n" +
                    "\t18. Zugzwangers\n" +
                    "\t19. It's a Blunderful Life\n" +
                    "\t20. Lemons and Lines\n" +
                    "\t21. Smack My Bishop\n" +
                    "\t22. Catch-22\n" +
                    "\t23. Regicide\n" +
                    "\t24. f8/Stay Knights\n" +
                    "\t25. Promote to Pawn\n" +
                    "\t26. Chess Mates\n"
                );
            })
        });
        it("test formatBoardResponse", function() {
            return _45_league.formatBoardResponse(1).then(function(message) {
                assert.equal(
                    message,
                    "Board 1 consists of... \n" +
                    "\tJyr: (Rating: 1500; Team: Disco Dancers)\n" +
                    "\tandyquibler: (Rating: 1500; Team: ¡No en-pasarán!)\n" +
                    "\tAtrophied: (Rating: 1500; Team: Icy Tactics)\n" +
                    "\tPitrinu: (Rating: 1500; Team: The Zugzwang Clan)\n" +
                    "\tShammies: (Rating: 1500; Team: Magnus Opus)\n" +
                    "\tMatuiss2: (Rating: 1500; Team: Sicilian Dragons)\n" +
                    "\tSuperVJ: (Rating: 1500; Team: Sac' Up)\n" +
                    "\tcyanfish: (Rating: 1500; Team: No Pawn Intended)\n" +
                    "\tSonata2: (Rating: 1500; Team: Highway Karjaking)\n" +
                    "\tSjaart: (Rating: 1500; Team: All Knight Dance Party)\n" +
                    "\tcrabbypat: (Rating: 1500; Team: Knights Who Say 'Nf3')\n" +
                    "\tHyzer: (Rating: 1500; Team: Legalize Caruana)\n" +
                    "\tBloodyfox: (Rating: 1500; Team: Team N/A)\n" +
                    "\tPawnprecaution: (Rating: 1500; Team: Sac's on the Beach)\n" +
                    "\tSteiger07: (Rating: 1500; Team: The Stale Maids)\n" +
                    "\ttheino: (Rating: 1500; Team: W.I.N.N.E.R.S.)\n" +
                    "\tecstaticbroccoli: (Rating: 1500; Team: Pawnbrokers)\n" +
                    "\tmhavgar: (Rating: 1500; Team: Zugzwangers)\n" +
                    "\tsangan: (Rating: 1500; Team: It's a Blunderful Life)\n" +
                    "\tToddle: (Rating: 1500; Team: Lemons and Lines)\n" +
                    "\teamonmont: (Rating: 1500; Team: Smack My Bishop)\n" +
                    "\tKobol: (Rating: 1500; Team: Catch-22)\n" +
                    "\tresonantpillow: (Rating: 1500; Team: Regicide)\n" +
                    "\tgnarlygoat: (Rating: 1500; Team: f8/Stay Knights)\n" +
                    "\tDoganof: (Rating: 1500; Team: Promote to Pawn)\n" +
                    "\tPasternak: (Rating: 1500; Team: Chess Mates)\n"

                );
            })
        });
        it("test formatTeamMembersResponse", function() {
            return _45_league.formatTeamMembersResponse("The Stale Maids").then(function(message) {
                assert.equal(
                    message,
                    "The members of The Stale Maids are \n" +
                    "\tBoard 1: Steiger07 (1500)\n" +
                    "\tBoard 2: R-Mena (1500)\n" +
                    "\tBoard 3: jmaltby (1500)\n" +
                    "\tBoard 4: EsolcNeveton (1500)\n" +
                    "\tBoard 5: lakinwecker (1500)\n" +
                    "\tBoard 6: Hkivrak (1500)\n"
                );
            })
        });
        it("test formatModsResponse", function() {
            return _45_league.formatModsResponse().then(function(message) {
                assert.equal(
                    message,
                    "45+45 mods: e\u200Bndrawes0, t\u200Bheino, m\u200Brlegilimens"
                );
            })
        });
        it("test formatSummonModsResponse", function() {
            slack.users.getIdString = function(name) {
                return "@<" + name + ">";
            }
            return _45_league.formatSummonModsResponse().then(function(message) {
                assert.equal(
                    message,
                    "45+45 mods: @<endrawes0>, @<theino>, @<mrlegilimens>"
                );
            })
        });
        it("test formatCaptainGuidelinesResponse", function(done) {
            var promises = [];

            // If there is a guidelines, then the response will contain it
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'captains': '<captain-guidelines>'}})
            );
            promises.push(
                _45_league.formatCaptainGuidelinesResponse().then(function(message) {
                    assert.equal(
                        message,
                        "Here are the captain's guidelines:\n<captain-guidelines>"
                    );
                })
            );
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'captains': undefined}})
            );
            promises.push(
                _45_league.formatCaptainGuidelinesResponse().then(function(message) {
                    assert.equal(
                        message,
                        "The 45+45 league does not have captains guidelines."
                    );
                })
            );
            Q.all(promises).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
        it("test formatPairingsLinkResponse", function(done) {
            var promises = [];

            // If there is a guidelines, then the response will contain it
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'team': '<pairings>'}})
            );
            promises.push(
                _45_league.formatPairingsLinkResponse().then(function(message) {
                    assert.equal(
                        message,
                        "Here is the pairings/standings sheet:\n<pairings>\nAlternatively, try [ @chesster pairing [competitor] ]"
                    );
                })
            );
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'team': undefined}})
            );
            promises.push(
                _45_league.formatPairingsLinkResponse().then(function(message) {
                    assert.equal(
                        message,
                        "The 45+45 league does not have a pairings/standings sheet."
                    );
                })
            );
            Q.all(promises).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
        it("test formatRulesLinkResponse", function(done) {
            var promises = [];

            // If there is a guidelines, then the response will contain it
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'rules': '<rules>'}})
            );
            promises.push(
                _45_league.formatRulesLinkResponse().then(function(message) {
                    assert.equal(
                        message,
                        "Here are the rules and regulations:\n<rules>"
                    );
                })
            );
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'rules': undefined}})
            );
            promises.push(
                _45_league.formatRulesLinkResponse().then(function(message) {
                    assert.equal(
                        message,
                        "The 45+45 league does not have a rules link."
                    );
                })
            );
            Q.all(promises).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
        it("test formatStarterGuideResponse", function(done) {
            var promises = [];

            // If there is a guidelines, then the response will contain it
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'guide': '<guide>'}})
            );
            promises.push(
                _45_league.formatStarterGuideResponse().then(function(message) {
                    assert.equal(
                        message,
                        "Here is everything you need to know:\n<guide>"
                    );
                })
            );
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'guide': undefined}})
            );
            promises.push(
                _45_league.formatStarterGuideResponse().then(function(message) {
                    assert.equal(
                        message,
                        "The 45+45 league does not have a starter guide."
                    );
                })
            );
            Q.all(promises).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
        it("test formatRegistrationResponse", function(done) {
            var promises = [];

            // If there is a guidelines, then the response will contain it
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'registration': '<registration>'}})
            );
            promises.push(
                _45_league.formatRegistrationResponse().then(function(message) {
                    assert.equal(
                        message,
                        "You can sign up here:\n<registration>"
                    );
                })
            );
            _45_league = new league.League(
                _.extend({}, _45_45_LEAGUE_CONF, {'links': { 'registration': undefined}})
            );
            promises.push(
                _45_league.formatRegistrationResponse().then(function(message) {
                    assert.equal(
                        message,
                        "The 45+45 league does not have an active signup form at the moment."
                    );
                })
            );
            Q.all(promises).then(function() {
                done();
            }, function(error) {
                done(error);
            });
        });
    });
});
