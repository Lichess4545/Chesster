var assert = require('chai').assert;
var moment = require("moment");
var scheduling = require('../scheduling');

var ISO_TUESDAY = 2;

describe('scheduling', function() {
    describe('#get_round_extrema()', function () {
        it(".isoWeekday() of the bounds should always return 2", function() {
            var bounds = scheduling.get_round_extrema();
            assert.equal(ISO_TUESDAY, bounds[0].isoWeekday());
            assert.equal(ISO_TUESDAY, bounds[1].isoWeekday());
        });
        it("The bounds containing 2016-04-15 are 2016-04-12T00:00:00 and 2016-04-19T:00:00:00 ", function() {
            var bounds = scheduling.get_round_extrema({
                containing_date: moment.utc("2016-04-15")
            });
            start = bounds[0];
            end = bounds[1];
            assert.equal(start.format(), "2016-04-12T00:00:00+00:00")
            assert.equal(end.format(), "2016-04-19T00:00:00+00:00")
        });
        it("The bounds containing 2016-04-15 but offset by an hour are 2016-04-11T23:00:00 and 2016-04-18T:23:00:00 ", function() {
            var bounds = scheduling.get_round_extrema({
                containing_date: moment.utc("2016-04-15"),
                offset_hours: 1
            });
            start = bounds[0];
            end = bounds[1];
            assert.equal(start.format(), "2016-04-11T23:00:00+00:00")
            assert.equal(end.format(), "2016-04-18T23:00:00+00:00")
        });
    });
    describe('#parse_scheduling()', function () {
        it("Test team-scheduling messages", function() {
            var options = {
                containing_date: moment.utc("2015-04-15")
            };
        });
        it("Test lonewolf-scheduling messages", function() {
            var options = {
                containing_date: moment.utc("2015-04-15"),
                offset_hours: 1
            };
            var test_cases = [
                ["@autotelic v @explodingllama 4/16 @ 0900 GMT", "2016-04-16:T09:00:00+00:00"],
            ];
            test_cases.forEach(function(test_case) {
                var results = scheduling.parse_scheduling(test_case[0], options);
                assert.equal(results.date.format(), test_case[1]);
            });
        });
    });
});


