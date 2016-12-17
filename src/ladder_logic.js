var moment = require("moment");

module.exports = function(db){
  function addChallenge(challenger, challengee, white){
      var date = moment().utc().format('YYYY-MM-DD HH:mm');
      var whiteIndex = Math.floor(Math.random() * 2);
      var white = whiteIndex == 0 ? challenger : challengee;

      db.recordChallenge(date, "Pending", challenger, challengee, white + " gets white");
  }

  return {
      addChallenge : addChallenge
  }
}