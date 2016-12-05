//------------------------------------------------------------------------------
// Common utilities for command implementations
//------------------------------------------------------------------------------
const _ = require("lodash");

function isCaptainOrModerator(speaker, speakerTeam, teamName, league){
    var  isLeagueModerator = league.isModerator(speaker.name);
    return isLeagueModerator || //speaker is a moderator
	( speakerTeam && //speaker is on a team
        speakerTeam.captain && //speaker's team has a captain
        _.isEqual(_.toLower(speaker.name), _.toLower(speakerTeam.captain.username)) && //speaker is the team captain
        _.isEqual(_.toLower(speakerTeam.name), _.toLower(teamName))); //speaker's team is the team being operated on
}

exports.isCaptainOrModerator = isCaptainOrModerator;
