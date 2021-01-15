import moment from 'moment'
import {expect} from 'chai'
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
    let buggyPairingJson = `{
        "pairings": [
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "fruend",
                "white_rating": 1289,
                "black": "GaliciaD",
                "black_rating": 1481,
                "game_link": "https://en.lichess.org/Rl8YrMR5",
                "result": "1-0",
                "datetime": "2020-12-16T19:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "Tranzoo",
                "white_rating": 1482,
                "black": "DonPauleone",
                "black_rating": 1232,
                "game_link": "https://en.lichess.org/Z7ILFs0l",
                "result": "1-0",
                "datetime": "2020-12-17T17:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "JeremyIsFishing",
                "white_rating": 1498,
                "black": "momor",
                "black_rating": 1278,
                "game_link": "",
                "result": "",
                "datetime": "2020-12-18T19:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "mmgoo",
                "white_rating": 1524,
                "black": "mynameismund",
                "black_rating": 1384,
                "game_link": "https://en.lichess.org/oSgYPTmz",
                "result": "1-0",
                "datetime": "2020-12-18T20:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "Vegemite_Fighter",
                "white_rating": 1382,
                "black": "PsychoVGC",
                "black_rating": 1565,
                "game_link": "https://en.lichess.org/K15IkyRg",
                "result": "1/2-1/2",
                "datetime": "2020-12-18T09:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "Lupo_Jones",
                "white_rating": 1432,
                "black": "Sesquipedalism",
                "black_rating": 1693,
                "game_link": "https://en.lichess.org/iZdokdvS",
                "result": "0-1",
                "datetime": "2020-12-15T22:05:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "Ferchosalgado",
                "white_rating": null,
                "black": "glbert",
                "black_rating": 1511,
                "game_link": "",
                "result": "",
                "datetime": null
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "WightUnderscore",
                "white_rating": 1390,
                "black": "Bole1981",
                "black_rating": 1769,
                "game_link": "",
                "result": "",
                "datetime": "2020-12-19T16:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "pulsar512b",
                "white_rating": 1472,
                "black": "SycoraxCirce",
                "black_rating": 1809,
                "game_link": "",
                "result": "1X-0F",
                "datetime": "2020-12-18T21:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "arian13862007",
                "white_rating": 1886,
                "black": "sgis",
                "black_rating": 1392,
                "game_link": "https://en.lichess.org/vReFMZuV",
                "result": "1-0",
                "datetime": "2020-12-18T09:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "MoistvonLipwig",
                "white_rating": 1811,
                "black": "LostEarthworm",
                "black_rating": 1683,
                "game_link": "https://en.lichess.org/zbDeSNP1",
                "result": "1-0",
                "datetime": "2020-12-16T19:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "lenguyenthanh",
                "white_rating": 1820,
                "black": "lion88",
                "black_rating": 1704,
                "game_link": "https://en.lichess.org/Hl68kPOa",
                "result": "1-0",
                "datetime": "2020-12-18T16:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "AACtrl",
                "white_rating": 1657,
                "black": "Scrooge",
                "black_rating": 1882,
                "game_link": "https://en.lichess.org/K9pZvXnM",
                "result": "0-1",
                "datetime": "2020-12-16T15:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "MoiRon",
                "white_rating": 1685,
                "black": "eie24",
                "black_rating": 1939,
                "game_link": "https://en.lichess.org/isCrTBTm",
                "result": "0-1",
                "datetime": "2020-12-17T20:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "CoachJohn",
                "white_rating": 1983,
                "black": "Narf64",
                "black_rating": 1717,
                "game_link": "https://en.lichess.org/fZh83oQ5",
                "result": "1-0",
                "datetime": "2020-12-16T19:00:00Z"
            },
            {
                "league": "chess960",
                "season": "14",
                "round": 2,
                "white": "Mixalaki2705",
                "white_rating": 1779,
                "black": "Silkthewanderer",
                "black_rating": 1991,
                "game_link": "",
                "result": "0F-1X",
                "datetime": "2020-12-20T21:00:00Z"
            }
        ]}
    `
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
    it('PairingsDecoder should decode a empty pairing list when null pairings received.', async function () {
        let pairings = PairingsDecoder.decodeJSON(
            `{"pairings": null, "error": "no_matching_rounds"}`
        )
        expect(pairings).to.be.empty
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
    it('PairingsDecoder should decode a pairings list.', async function () {
        let pairings = PairingsDecoder.decodeJSON(buggyPairingJson)
        expect(pairings.length).to.equal(16)
    })
})
