var moment = require('moment');

module.exports = function(spreadsheet){
    function recordChallenge(date, status, challenger, challengee, comments){
        spreadsheet.findFirstBlankLine(5, function(line){
	    spreadsheet.writeLine(5, line, [date, status, challenger, challengee, comments]);
	});
    }

    return {
        recordChallenge: recordChallenge
    }
}