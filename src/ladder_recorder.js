var winston = require('winston');

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

    function findChallenge(player1, player2, callback){
        var result = {};
        spreadsheet.findFirstBlankLine(5, function(line){
	    spreadsheet.getCells(5, 1, line-1, 3, 4, function(err, cells){
		if (err){
                    winston.error(err);
		} else {
                    winston.debug("got " + cells.length + " cells");
		    for (var i = cells.length - 2; i >= 0; i = i - 2){
                        winston.debug(cells[i].value + "/" + cells[i+1].value);
			if ((cells[i].value.toLowerCase() === player1.toLowerCase()) && (cells[i+1].value.toLowerCase() === player2.toLowerCase())) {
			    callback({ challenger: player1, challengee: player2 });
			    break;
			} 
			if ((cells[i].value.toLowerCase() === player2.toLowerCase()) && (cells[i+1].value.toLowerCase() === player1.toLowerCase())) {
			    callback({ challenger: player2, challengee: player1 });
			    break;
			}
		    }
		}
	    });
	});
        winston.debug("result in recorder");
        winston.debug(result);
        return result;
    }

    return {
	recordChallenge: recordChallenge,
        recordGame: recordGame,
        findChallenge: findChallenge
    };
};