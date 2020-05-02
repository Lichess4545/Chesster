import moment from 'moment'
import { expect } from 'chai'
import {
    IndividualPairingDecoder,
    PairingDecoder,
    PairingsDecoder,
    Pairing,
    Player,
    PlayerDecoder,
    RosterDecoder,
} from '../src/heltour'

describe('Heltour parsing Tests', () => {
    let pairingsJson = `
        {
          "pairings": [
            {
              "league": "chess960",
              "season": "10",
              "round": 7,
              "white": "pulsar512b",
              "white_rating": 1250,
              "black": "darubaru",
              "black_rating": 1399,
              "game_link": "",
              "result": "",
              "datetime": null
            },
            {
              "league": "chess960",
              "season": "10",
              "round": 7,
              "white": "sgis",
              "white_rating": 1439,
              "black": "TaielChess",
              "black_rating": 1567,
              "game_link": "https://en.lichess.org/clC9LqlI",
              "result": "0-1",
              "datetime": "2020-03-29T20:13:59Z"
            }
          ]
        }`
    let individualPairingJson1 = `{
      "league": "chess960",
      "season": "10",
      "round": 7,
      "white": "pulsar512b",
      "white_rating": 1250,
      "black": "darubaru",
      "black_rating": 1399,
      "game_link": "",
      "result": "",
      "datetime": null
    }`
    let individualPairingJson2 = `{
      "league": "chess960",
      "season": "10",
      "round": 7,
      "white": "sgis",
      "white_rating": 1439,
      "black": "TaielChess",
      "black_rating": 1567,
      "game_link": "https://en.lichess.org/clC9LqlI",
      "result": "0-1",
      "datetime": "2020-03-29T20:13:59Z"
    }`
    let testPairing1 = (p: Pairing) => {
        expect(p.round).to.equal(7)
        expect(p.league).to.equal('chess960')
        expect(p.season).to.equal('10')
        expect(p.white).to.equal('pulsar512b')
        expect(p.whiteRating).to.equal(1250)
        expect(p.black).to.equal('darubaru')
        expect(p.blackRating).to.equal(1399)
        expect(p.gameLink).to.equal('')
        expect(p.result).to.equal('')
        expect(p.datetime).to.equal(undefined)
    }
    let testPairing2 = (p: Pairing) => {
        expect(p.round).to.equal(7)
        expect(p.league).to.equal('chess960')
        expect(p.season).to.equal('10')
        expect(p.white).to.equal('sgis')
        expect(p.whiteRating).to.equal(1439)
        expect(p.black).to.equal('TaielChess')
        expect(p.blackRating).to.equal(1567)
        expect(p.gameLink).to.equal('https://en.lichess.org/clC9LqlI')
        expect(p.result).to.equal('0-1')
        expect(p.datetime?.format('YYYY-MM-DD HH:mm:ss')).to.equal(
            '2020-03-29 20:13:59'
        )
    }
    it('IndividualPairingDeocoder should decode a pairing object.', async function () {
        let decoders = [IndividualPairingDecoder, PairingDecoder]
        decoders.map((decoder) => {
            let pairing1 = decoder.decodeJSON(individualPairingJson1)
            testPairing1(pairing1)

            let pairing2 = decoder.decodeJSON(individualPairingJson2)
            testPairing2(pairing2)
        })
    })
    it('PairingsDecoder should decode a pairings list.', async function () {
        let pairings = PairingsDecoder.decodeJSON(pairingsJson)
        testPairing1(pairings[0])
        testPairing2(pairings[1])
    })

    let player1Json = `
        {
          "username": "sgis",
          "rating": 1431,
          "board": 6
        }
    `
    let player2Json = `
        {
          "username": "TaielChess",
          "rating": 1575,
          "board": 6
        }
    `
    let rosterJson = `
        {
          "league": "chess960",
          "season": "10",
          "players": [
            ${player1Json},
            ${player2Json}
          ]
        }
    `
    let testPlayer1 = (p: Player) => {
        expect(p.username).to.equal('sgis')
        expect(p.rating).to.equal(1431)
    }
    let testPlayer2 = (p: Player) => {
        expect(p.username).to.equal('TaielChess')
        expect(p.rating).to.equal(1575)
    }
    it('PlayerDecoder should decode a player object.', async function () {
        let player1 = PlayerDecoder.decodeJSON(player1Json)
        testPlayer1(player1)
        let player2 = PlayerDecoder.decodeJSON(player2Json)
        testPlayer2(player2)
    })
    it('RosterDecoder should decode a roster object.', async function () {
        let roster = RosterDecoder.decodeJSON(rosterJson)
        expect(roster.league).to.equal('chess960')
        expect(roster.season).to.equal('10')
        testPlayer1(roster.players[0])
        testPlayer2(roster.players[1])
    })
})
