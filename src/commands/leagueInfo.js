//------------------------------------------------------------------------------
// Commands related to league information
//------------------------------------------------------------------------------
module.exports = function(chesster, slack){
  const Q = require("q");
  
  // A helper for a very common pattern
  function directResponse(responseName) {
      return function(bot, message) {
          return message.league[responseName]().then(function(response) {
              bot.reply(message, response);
          });
      };
  }
  // A helper for a very common pattern
  function dmResponse(responseName) {
      return function (bot, message) {
          var deferred = Q.defer();
          bot.startPrivateConversation(message, function (response, convo) {
              message.league[responseName]().then(function(response) {
                  convo.say(response);
                  deferred.resolve();
              }, function(error) {
                  deferred.reject(error);
              });
          });
          return deferred.promise;
      };
  }

  // A helper for a very common pattern
  function directRequiresLeague(patterns, callback) {
      chesster.hears(
          {
              middleware: [slack.requiresLeague],
              patterns: patterns,
              messageTypes: ['direct_message', 'direct_mention']
          },
          callback
      );
  }

  directRequiresLeague(
      ['captain guidelines'],
      directResponse('formatCaptainGuidelinesResponse')
  );
  directRequiresLeague(
      ['captains', 'captain list'],
      dmResponse('formatCaptainsResponse')
  );
  directRequiresLeague(
      ["faq"],
      directResponse('formatFAQResponse')
  );
  directRequiresLeague(
      ['notify mods', 'summon mods'],
      directResponse('formatSummonModsResponse')
  );
  directRequiresLeague(
      ['^mods$', '^moderators$'],
      directResponse('formatModsResponse')
  );
  directRequiresLeague(
      ['pairings'],
      directResponse('formatPairingsLinkResponse')
  );
  directRequiresLeague(
      ['rules', 'regulations'],
      directResponse('formatRulesLinkResponse')
  );
  directRequiresLeague(
      ['standings'],
      directResponse('formatStandingsLinkResponse')
  );
  directRequiresLeague(
      ['^welcome$', 'starter guide', 'player handbook'],
      directResponse('formatStarterGuideResponse')
  );
}

