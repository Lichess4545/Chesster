//------------------------------------------------------------------------------
// Lichess helpers
//------------------------------------------------------------------------------
var http = require("./http.js");


// TODO: Ensure we have 

// TODO: eventually cache these results.
function getPlayerByName(name){
    var url = "http://en.lichess.org/api/user/" + name;
    return http.fetchURLIntoJSON(url);
}

function getPlayerRating(name){
    return getPlayerByName(name).then(function(playerInfo) {
      return playerInfo.perfs.classical.rating;
    });
}

module.exports.getPlayerRating = getPlayerRating
module.exports.getPlayerByName = getPlayerByName
