module.exports = function(spreadsheet){
    function recordChallenge(date, status, challenger, challengee, comments){
        spreadsheet.findFirstBlankLine(5, function(line){
	    spreadsheet.writeLine(5, line, [date, status, challenger, challengee, comments]);
	});
    }

    function recordGame(date, white, black, challenger, challengee, link, result){
        spreadsheet.findFirstBlankLine(6, function(line){
	    spreadsheet.writeLine(6, line, [date, white, black, challenger, challengee, link, result]);
	});
    }

    return {
	recordChallenge: recordChallenge,
        recordGame: recordGame
    };
};