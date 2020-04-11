//------------------------------------------------------------------------------
// Lichess API helpers
//------------------------------------------------------------------------------
import * as http from './http'
import moment from 'moment-timezone'
import _ from 'lodash'
import winston from 'winston'
// TODO: sequelize-cli requires us to call this models.js or models/index.js
//       this name conflicts with the parameter that we pass in after getting
//       the lock, so I'd like to (by convention) always refer to this as db.
import * as db from './models'

var MILISECOND = 1
var SECONDS = 1000 * MILISECOND

export type LichessID = string
export type LichessName = string
export type LichessResponse = any
export type PlayerResponse = any

type QueuedRequest = {
    url: string
    isJSON: boolean
    resolve: (value?: any) => void
    reject: (reason?: any) => void
}

//------------------------------------------------------------------------------
// A lichess API queue.
//
// Provides two queues, a background queue and main queue. Use the main queue
// for any processing in response to a user message, as the main queue takes
// priority.
//
// Use the background queue for any background updating, like player ratings.
//
// Also attempts to rate limit itself according to the lichess API guidelines
// a max of one request every 2 seconds (this is actually a bit slower), and
// it will wait a minute if it receives a 429.
//------------------------------------------------------------------------------
let { makeRequest, processRequests } = (function () {
    // The background queue will be processed when there is nothing else to process
    var backgroundQueue: QueuedRequest[] = []
    // The mainQueue will be processed first.
    var mainQueue: QueuedRequest[] = []
    function makeRequest(url: string, isJSON: boolean, isBackground: boolean) {
        return new Promise((resolve, reject) => {
            if (isBackground) {
                backgroundQueue.push({ url, isJSON, resolve, reject })
            } else {
                mainQueue.push({ url, isJSON, resolve, reject })
            }
        })
    }
    function processRequests() {
        console.log(new Error().stack)
        var request = null
        // The default delay between requests is 2 seconds
        var requestDelay = 2 * SECONDS
        if (mainQueue.length > 0 || backgroundQueue.length > 0) {
            winston.info(
                `[LICHESS] ${mainQueue.length} requests in mainQueue ` +
                    `${backgroundQueue.length} requests in backgroundQueue`
            )
        }
        if (mainQueue.length > 0) {
            request = mainQueue.shift()
        } else if (backgroundQueue.length > 0) {
            request = backgroundQueue.shift()
        }
        if (request) {
            var url = request.url
            var isJSON = request.isJSON
            var resolve = request.resolve
            var reject = request.reject
            var promise = null
            try {
                promise = http.fetchURL(url)
                promise.then(
                    function (result) {
                        try {
                            if (result.response.statusCode === 429) {
                                requestDelay = 60 * SECONDS
                                winston.info(
                                    '[LICHESS] Last request status was a 429 - we will wait 60 seconds before our next request'
                                )
                            } else {
                                if (mainQueue.length > 0) {
                                    requestDelay = 2 * SECONDS
                                } else {
                                    // Back off a bit if we only have background requests.
                                    requestDelay = 4 * SECONDS
                                }
                                if (isJSON) {
                                    var json = JSON.parse(result['body'])
                                    if (json) {
                                        resolve({ ...result, json })
                                    } else {
                                        winston.error(
                                            "[LICHESS] Asked for JSON - but didn't get it"
                                        )
                                        winston.error(
                                            '[LICHESS] ' +
                                                JSON.stringify(result)
                                        )
                                        reject('Not JSON')
                                    }
                                } else {
                                    resolve(result)
                                }
                            }
                            setTimeout(processRequests, requestDelay)
                        } catch (e) {
                            winston.error('[LICHESS] Exception: ' + e)
                            winston.error('[LICHESS] Stack: ' + e.stack)
                            winston.error('[LICHESS] URL: ' + url)
                            reject(e)
                            setTimeout(processRequests, requestDelay)
                        }
                    },
                    function (error) {
                        winston.error(
                            `[LICHESS] Request failed: ${JSON.stringify(error)}`
                        )
                        setTimeout(processRequests, requestDelay)
                        reject(error)
                    }
                )
            } catch (e) {
                winston.error('[LICHESS] Exception: ' + e)
                winston.error('[LICHESS] Stack: ' + e.stack)
                reject(e)
                setTimeout(processRequests, requestDelay)
            }
        } else {
            setTimeout(processRequests, requestDelay)
        }
    }
    return { makeRequest, processRequests }
})()

export function startLichessQueue() {
    processRequests()
}

export async function getPlayerByName(name: string, isBackground: boolean) {
    var url = 'https://lichess.org/api/user/' + name
    return makeRequest(url, true, isBackground)
}

//------------------------------------------------------------------------------
// Get a player rating, but only ping lichess once every 30 minutes for each
// player.  It's supposed to be a classical rating, so it probably won't update
// that often in a 30 minutes period. Besides, this function is not intended
// for people to show off their latest rating.  If they wan to do that they
// can type it in themselves.
//------------------------------------------------------------------------------
//--------------------------------------------------------------------------
async function _updateRating(name: string, isBackground: boolean) {
    //store the promise for reuse
    try {
        let result: PlayerResponse = await getPlayerByName(name, isBackground)
        var rating = result.json.perfs.classical.rating
        // Get the writable lock for the database.
        let lichessRatings = await db.LichessRating.findOrCreate({
            where: { lichessUserName: name },
        })
        var lichessRating = lichessRatings[0]
        lichessRating.set('rating', rating)
        lichessRating.set('lastCheckedAt', moment.utc().toDate())
        lichessRating.save().then(function () {
            winston.info(`Got updated rating for ${name}: ${rating}`)
        })
        return rating
    } catch (error) {
        winston.error('Error getting player by name: ' + error)
    }
}

//--------------------------------------------------------------------------
// Get the player rating. Always return the most recent rating from the
// database, unless they don't have it. Then go get it and return it.
//--------------------------------------------------------------------------
export async function getPlayerRating(
    name: string,
    isBackground: boolean = false
) {
    name = name.toLowerCase()

    try {
        // Ensure we have a record.
        let lichessRatingRec = await db.LichessRating.findOrCreate({
            where: { lichessUserName: name },
        })
        let lichessRating = lichessRatingRec[0]

        var _30MinsAgo = moment.utc().subtract(30, 'minutes')
        var lastCheckedAt = moment(lichessRating.get('lastCheckedAt'))
        if (lastCheckedAt) {
            lastCheckedAt = moment.utc(lastCheckedAt)
        }

        //if a promise exists, then the player is already queued
        var rating = lichessRating.get('rating')

        // Only update the rating if it's older than 30 minutes
        // or if we don't have one a rating
        if (
            _.isNil(rating) ||
            !lastCheckedAt ||
            lastCheckedAt.isBefore(_30MinsAgo)
        ) {
            // If we don't have it or it's out of date
            return await _updateRating(name, isBackground)
        }

        return lichessRating.get('rating')
    } catch (error) {
        winston.error(`Error querying for rating: ${error}`)
    }
}
