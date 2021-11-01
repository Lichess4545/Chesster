// import { assert, expect, use } from "chai";
// import * as sinon from "sinon"
// import sinonChai from "sinon-chai";
// import * as subscription from "../src/commands/subscription";
// import { emitter, formatAGameStarts, register } from "../src/commands/subscription";
// import { User } from "../src/heltour";
// import * as league from "../src/league";
// import { ResultsEnum } from "../src/league";
// import { GameDetails, GameStatus } from "../src/lichess";
// import * as db from "../src/models"
// import * as slack from "../src/slack";
// import { isDefined } from "../src/utils";
//
// use(sinonChai)
//
// describe('subscription', () => {
//     describe('#getListeners', () => {
//         const configFile = '../config/testconfig.js'
//         const chesster = new slack.SlackBot('lichess4545', configFile)
//         const mockLeagueOr = league.getLeague(chesster, '45+45')
//         if (!isDefined(mockLeagueOr)) {
//             assert.fail('Unable to load league')
//             return
//         }
//         const mockLeague: league.League = mockLeagueOr
//
//         const whiteListen: User = {name: 'white-listen'}
//         const blackListen: User = {name: 'black-listen'}
//         const whiteNoListen: User = {name: 'white-no-listen'}
//         const blackNoListen: User = {name: 'black-no-listen'}
//
//         it('should add correct source', () => {
//             const mockDetails: GameDetails = {
//                 id: 'abcdefg',
//                 rated: true,
//                 variant: 'standard',
//                 speed: 'classical',
//                 perf: 'classical',
//                 createdAt: 1476567724919,
//                 players: {
//                     white: {
//                         user: { id: whiteNoListen.name, name: whiteNoListen.name },
//                         rating: 1680,
//                     },
//                     black: {
//                         user: { id: blackListen.name, name: blackListen.name },
//                         rating: 1418,
//                     },
//                 },
//                 status: GameStatus.started,
//                 result: ResultsEnum.UNKNOWN,
//                 game_link: 'https://lichess.org/abcdefg',
//                 clock: { initial: 2700, increment: 45 }
//             }
//
//             const mockSubscriptions: db.Subscription[] = [
//                 {
//                     id: 1,
//                     requester: 'subscriber',
//                     source: 'black-listen',
//                     target: 'subscriber',
//                     event: 'a-game-starts',
//                     league: '45+45'
//                 } as unknown as db.Subscription
//             ]
//
//             sinon.stub(db.Subscription).findAll.resolves(mockSubscriptions)
//             const formatSpy = sinon.spy(subscription, 'formatAGameStarts')
//
//             register(chesster, 'a-game-starts', formatAGameStarts)
//             emitter.emit(
//                 'a-game-starts',
//                 mockLeague,
//                 [whiteNoListen.name, blackListen.name],
//                 {
//                     league: mockLeague,
//                     details: mockDetails,
//                     white: whiteNoListen,
//                     black: blackListen,
//                 }
//             )
//
//             // TODO: Add asserts on formatSpy - asynchronous nature of event handler breaks spies
//             // For now this can be run manually
//         })
//     })
// })
