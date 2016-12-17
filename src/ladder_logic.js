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

  return {
      addChallenge : addChallenge
  };
};