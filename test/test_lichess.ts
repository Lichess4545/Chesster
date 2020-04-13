import { expect, assert } from 'chai'
import {
    fetchUserByName,
    fetchGameDetails,
    startQueue,
    stopQueue,
} from '../src/lichess'

describe('lichess api', () => {
    it('fetchGameDetails should return an appropriate object', async function () {
        startQueue()
        try {
            var gameDetails = await fetchGameDetails('Z976MipV')
            expect(gameDetails.players.black.user.id).to.equal('lakinwecker')
            expect(gameDetails.players.white.user.id).to.equal('adrienb96')
            var gameDetails = await fetchGameDetails('PevZ3mq1')
            expect(gameDetails.players.black.user.id).to.equal('lakinwecker')
            expect(gameDetails.players.white.user.id).to.equal('drnicholas')
        } finally {
            stopQueue()
        }
    })
    it('fetchUserByName should return an appropriate object', async function () {
        this.timeout(5000)
        startQueue()
        try {
            var user = await fetchUserByName('lakinwecker')
            expect(user.username).to.equal('lakinwecker')
            var user = await fetchUserByName('chesster')
            expect(user.username).to.equal('Chesster')
        } finally {
            stopQueue()
        }
    })
})
