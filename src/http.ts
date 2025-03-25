// -----------------------------------------------------------------------------
// HTTP helpers
// -----------------------------------------------------------------------------
import _http from 'http'
import _https from 'https'
import url from 'url'
import querystring from 'querystring'
import winston from 'winston'
import _ from 'lodash'

export interface Response {
    response: _http.IncomingMessage
    body: string
}

export interface RequestOptions extends _http.RequestOptions {
    parameters?: Record<string, string>
    bodyParameters?: Record<string, string | number | boolean>
    href?: string
}
function isString(uri: RequestOptions | string): uri is string {
    return _.isString(uri)
}
export function requestFromString(uri: string): RequestOptions {
    return url.parse(uri)
}
export interface JSONResponse extends Response {
    json: any
}

export function fetchURL(
    optionsOrString: RequestOptions | string
): Promise<Response> {
    let options: RequestOptions
    if (isString(optionsOrString)) {
        options = requestFromString(optionsOrString)
    } else {
        options = optionsOrString
    }

    return new Promise((resolve, reject) => {
        let http: typeof _http | typeof _https = _http
        if (_.isEqual(options.protocol, 'https:')) {
            http = _https
        }

        if (options.parameters) {
            options.path += '?' + querystring.stringify(options.parameters)
        }
        let bodyParameters = null
        if (options.bodyParameters) {
            bodyParameters = querystring.stringify(options.bodyParameters)
            options.headers = options.headers || {}
            options.headers['Content-Type'] =
                'application/x-www-form-urlencoded'
            options.headers['Content-Length'] =
                Buffer.byteLength(bodyParameters)
        }
        const req = http
            .request(options, (res) => {
                let body = ''
                res.on('data', (chunk) => {
                    body += chunk
                })
                res.on('end', () => {
                    resolve({ response: res, body })
                })
            })
            .on('error', (e) => {
                winston.error(JSON.stringify(e))
                reject('failed to get a response from url: ' + options.href)
            })
        if (bodyParameters) {
            req.write(bodyParameters)
        }
        req.end()
    })
}

export function fetchURLIntoJSON(
    options: RequestOptions | string
): Promise<JSONResponse> {
    return new Promise((resolve, reject) => {
        fetchURL(options).then(
            (result) => {
                try {
                    const json = JSON.parse(result.body)
                    if (json) {
                        resolve({ ...result, json })
                    } else {
                        winston.error(
                            '[HTTP] Options: ' + JSON.stringify(options)
                        )
                        winston.error('[HTTP] Body: ' + result.body)
                        winston.error(
                            '[HTTP] Status Code: ' + result.response.statusCode
                        )
                        winston.error(
                            '[HTTP] Status Message: ' +
                                result.response.statusMessage
                        )
                        reject(
                            'body was not a valid json object: ' +
                                JSON.stringify(result.body)
                        )
                    }
                } catch (e) {
                    winston.error('[HTTP] Options: ' + JSON.stringify(options))
                    winston.error('[HTTP] Exception: ' + e)
                    // @ts-ignore - this was getting in my way when trying to build chesster locally
                    winston.error('[HTTP] Stack: ' + e.stack)
                    winston.error('[HTTP] Body: ' + result.body)
                    winston.error(
                        '[HTTP] Status Code: ' + result.response.statusCode
                    )
                    winston.error(
                        '[HTTP] Status Message: ' +
                            result.response.statusMessage
                    )
                    reject(e)
                }
            },
            (error) => {
                reject(error)
            }
        )
    })
}
