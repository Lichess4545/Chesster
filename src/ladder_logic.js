var moment = require("moment");

module.exports = function(db){
  function addChallenge(challenger, challengee, white){
      var date = moment().utc().format('MM/DD/YYYY');
      
      if (!white) {
	  var whiteIndex = Math.floor(Math.random() * 2);
          white = whiteIndex === 0 ? challenger : challengee;
      }
      db.recordChallenge(date, "Pending", challenger, challengee, white + " gets white");
  }

  function addGame(white, black, challenger, link, result){
      var date = moment().utc().format('MM/DD/YYYY');
      var challengee = challenger === white ? black : white;

      db.recordGame(date, white, black, challenger, challengee, link, result);
  }

  function findChallenge(player1, player2, callback){
      db.findChallenge(player1, player2, function(result){
	  callback(result);
      });
  }

  return {
      addChallenge : addChallenge,
      addGame : addGame,
      findChallenge: findChallenge
  };
};