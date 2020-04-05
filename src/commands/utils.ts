//------------------------------------------------------------------------------
// Common utilities for command implementations
//------------------------------------------------------------------------------
import _ from 'lodash'
import { League, Team } from '../league'
import { LeagueMember } from '../slack'

export function isCaptainOrModerator(
    speaker: LeagueMember,
    speakerTeam: Team,
    teamName: string,
    league: League
) {
    var isLeagueModerator = league.isModerator(speaker.lichess_username)
    return (
        isLeagueModerator || //speaker is a moderator
        (speakerTeam && //speaker is on a team
        speakerTeam.captain && //speaker's team has a captain
        _.isEqual(
            _.toLower(speaker.lichess_username),
            _.toLower(speakerTeam.captain.username)
        ) && //speaker is the team captain
            _.isEqual(_.toLower(speakerTeam.name), _.toLower(teamName)))
    ) //speaker's team is the team being operated on
}

