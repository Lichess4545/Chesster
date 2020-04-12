import { assert } from 'chai'
import moment from 'moment'
import * as games from '../src/commands/games'
import * as slack from '../src/slack'
import * as league from '../src/league'
import { isDefined } from '../src/utils'
import winston from 'winston'
winston.add(
    new winston.transports.Console({
        format: winston.format.simple(),
    })
)

interface ExpectedResults {
    white: string | undefined
    black: string | undefined
    result: string | undefined
}

// we are exposing 2 new functions - parseResult and updateResult
// we cant unit test updateResult becauase it has side effects and depends on the spreadsheet.
// A thorough test of thhose functions would require a lot of setup and tear down or a mock spreadsheet.
// ill stick with the tests for result oarsing.
describe('games', function () {
    describe('#parseResult', function () {
        it('Test result format parsing.', function () {
            function testParseResult(
                message: string,
                expected: ExpectedResults | undefined
            ) {
                let result = games.parseResult(message)
                assert.deepEqual(result, expected, message)
            }
            testParseResult('<@U1234567> v <@U2345678> 1-0', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '1-0',
            })
            testParseResult('<@U1234567> 0-1 <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '0-1',
            })
            testParseResult('<@U1234567> 0-0 <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '0-0',
            })
            testParseResult('<@U1234567> 0F-1X <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '0F-1X',
            })
            testParseResult('<@U1234567> 1X-0F <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '1X-0F',
            })
            testParseResult('<@U1234567> 1/2Z-1/2Z <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '1/2Z-1/2Z',
            })
            testParseResult('<@U1234567> 0F-0F <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '0F-0F',
            })
            testParseResult('<@U1234567> and <@U2345678> drew', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '1/2-1/2',
            })
            testParseResult('<@U1234567> 0.5-0.5 <@U2345678>', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '1/2-1/2',
            })
            testParseResult('the <@U1234567> and <@U2345678> game was a draw', {
                white: '<@U1234567>',
                black: '<@U2345678>',
                result: '1/2-1/2',
            })
            testParseResult(
                'this has only one player <@U1234567> and no result',
                undefined
            )
            testParseResult(
                'this has only two players <@U1234567> v <@U2345678> and no result',
                undefined
            )
            testParseResult('this has no players but a result 1-0', undefined)
        })
    })

    describe('#parseGamelink', function () {
        it('Tests gamelinks format parsing.', function () {
            function testParseGamelink(
                message: string,
                expected: string | undefined
            ) {
                var result = games.parseGamelink(message)
                assert.equal(result.gamelinkID, expected)
            }
            testParseGamelink(
                '<@U1234567> http://en.lichess.org/H5YNnlR5RqMN',
                'H5YNnlR5RqMN'
            )
            testParseGamelink(
                'http://en.lichess.org/H5YNnlR5RqMN/white',
                'H5YNnlR5RqMN'
            )
            testParseGamelink(
                'http://en.lichess.org/H5YNnlR5RqMN/black',
                'H5YNnlR5RqMN'
            )
            testParseGamelink(
                'some words http://en.lichess.org/H5YNnlR5RqMN and other stuff',
                'H5YNnlR5RqMN'
            )
            testParseGamelink(
                '<en.lichess.org/ClhKGw8s|en.lichess.org/ClhKGw8s>',
                'ClhKGw8s'
            )
            testParseGamelink('there is no link here', undefined)
        })
    })

    describe('#validateGameDetails', function () {
        it('Tests game details validation.', function () {
            var configFile = '../config/config.js'
            let chesster = new slack.SlackBot('lichess4545', configFile)
            let mockLeagueOr = league.getLeague(chesster, '45+45')
            if (!isDefined(mockLeagueOr)) {
                assert.fail('Unable to load league')
                return
            }
            let mockLeague: league.League = mockLeagueOr

            // Set the reference date for testing.
            if (mockLeague.scheduling)
                mockLeague.scheduling.referenceDate = moment('2016-10-15')
            function testValidateGameDetails(
                details: games.LichessGameDetails,
                pairings: league.Pairing[],
                expected: games.GameValidationResult
            ) {
                mockLeague._pairings = pairings
                var result = games.validateGameDetails(mockLeague, details)
                expected.pairing = pairings[0]
                assert.deepEqual(result, expected)
            }
            let mockPairing = (
                white: string,
                black: string
            ): league.Pairing => ({
                white,
                black,
                result: league.ResultsEnum.UNKNOWN,
            })
            let mockValidationResult: games.GameValidationResult = {
                valid: false,
                pairing: undefined,
                pairingWasNotFound: false,
                colorsAreReversed: false,
                gameIsUnrated: false,
                timeControlIsIncorrect: false,
                variantIsIncorrect: false,
                gameOutsideOfCurrentRound: false,
                claimVictoryNotAllowed: false,
                cheatDetected: false,
                reason: '',
            }
            testValidateGameDetails(
                {
                    id: 'gVbuwhK3',
                    rated: true,
                    variant: 'standard',
                    speed: 'classical',
                    perf: 'classical',
                    createdAt: 1476567724919,
                    status: 35,
                    clock: { initial: 2700, increment: 45 },
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [mockPairing('happy0', 'tephra')],
                { ...mockValidationResult, valid: true }
            )
            testValidateGameDetails(
                {
                    id: 'gVbuwhK3',
                    rated: true,
                    variant: 'standard',
                    speed: 'classical',
                    perf: 'classical',
                    createdAt: 1476567724919,
                    status: 35,
                    clock: { initial: 2700, increment: 45 },
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [],
                {
                    ...mockValidationResult,
                    valid: false,
                    pairingWasNotFound: true,
                    reason: 'the pairing was not found.',
                }
            )
            testValidateGameDetails(
                {
                    id: 'gVbuwhK3',
                    rated: true,
                    variant: 'standard',
                    speed: 'classical',
                    perf: 'classical',
                    createdAt: 1476567724919,
                    status: 35,
                    clock: { initial: 2700, increment: 45 },
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [mockPairing('tephra', 'happy0')],
                {
                    ...mockValidationResult,
                    valid: false,
                    colorsAreReversed: true,
                    reason: 'the colors are reversed.',
                }
            )
            testValidateGameDetails(
                {
                    id: 'gVbuwhK3',
                    rated: false,
                    variant: 'standard',
                    speed: 'classical',
                    perf: 'classical',
                    createdAt: 1476567724919,
                    status: 35,
                    clock: { initial: 2700, increment: 45 },
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [mockPairing('happy0', 'tephra')],
                {
                    ...mockValidationResult,
                    valid: false,
                    gameIsUnrated: true,
                    reason: 'the game is unrated.',
                }
            )
            testValidateGameDetails(
                {
                    id: 'gVbuwhK4',
                    rated: true,
                    variant: 'standard',
                    speed: 'correspondence',
                    perf: 'correspondence',
                    createdAt: 1476567724919,
                    status: 35,
                    daysPerTurn: 5,
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [mockPairing('happy0', 'tephra')],
                {
                    ...mockValidationResult,
                    valid: false,
                    timeControlIsIncorrect: true,
                    reason: 'the time control is incorrect.',
                }
            )
            testValidateGameDetails(
                {
                    id: 'gVbuwhK3',
                    rated: true,
                    variant: 'chess960',
                    speed: 'classical',
                    perf: 'classical',
                    createdAt: 1476567724919,
                    status: 35,
                    clock: { initial: 2700, increment: 45 },
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [mockPairing('happy0', 'tephra')],
                {
                    ...mockValidationResult,
                    valid: false,
                    variantIsIncorrect: true,
                    reason: 'the variant should be standard.',
                }
            )
            testValidateGameDetails(
                {
                    id: 'gVbuwhK3',
                    rated: true,
                    variant: 'standard',
                    speed: 'classical',
                    perf: 'classical',
                    createdAt: 1477567724919,
                    status: 35,
                    clock: { initial: 2700, increment: 45 },
                    players: {
                        white: { userId: 'happy0', rating: 1680 },
                        black: { userId: 'tephra', rating: 1418 },
                    },
                },
                [mockPairing('happy0', 'tephra')],
                {
                    ...mockValidationResult,
                    valid: false,
                    gameOutsideOfCurrentRound: true,
                    reason: 'the game was not played in the current round.',
                }
            )
        })
    })
})
