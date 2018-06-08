/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict'

const urlFormat = require('url').format
const underscore = require('underscore')
const responses = require('../data/responses')
const urlParse = require('../../browser-laptop/app/common/urlParse')

const hostLookup = {
  'ledger.brave.com': 'ledger-proxy.privateinternetaccess.com',
  'ledger.mercury.basicattentiontoken.org': 'mercury-proxy.privateinternetaccess.com'
}

const getResponse = (url, currWallet) => {
  let response = {}
  const path = urlParse(url).path

  if (path.match(/\/v2\/wallet\?publicKey/)) {
    return responses['/v2/wallet/id'][currWallet]
  } else if (path.match(/\/v2\/wallet/)) {
    return responses['/v2/wallet/balance'][currWallet]
  } else if (path.match(/\/v2\/registrar\/persona/)) {
    return path.split('/').length === 4
      ? responses['/v2/registrar/persona']['initial-registrar']
      : {}
  }

  if (responses.hasOwnProperty(path)) {
    return responses[path]
  }

  return response
}

const request = (options, callback, currWallet) => {
  let params
  const responseBody = getResponse(options.url, currWallet)

  if (underscore.isEmpty(responseBody)) {
    callback(null, {statusCode: 200}, responseBody)
  }

  if (typeof options === 'string') {
    options = { url: options }
  }
  params = underscore.defaults(underscore.pick(options, [ 'method', 'headers' ]), { headers: {} })
  params.headers['accept-encoding'] = ''

  if (options.payload) {
    underscore.extend(params, {
      payload: JSON.stringify(options.payload),
      payload_content_type: params.headers['content-type'] || 'application/json; charset=utf-8'
    })
  }

  if (typeof options.url !== 'string') {
    return callback(new Error('URL is not valid'))
  }

  if (process.env.NODE_ENV === 'development' &&
      urlParse(options.url).protocol === 'http:') {
  }

  callback(null, {statusCode: 200}, responseBody)
}

const roundtrip = (params, options, callback, currWallet) => {
  const binaryP = options.binaryP
  let parts = typeof params.server === 'string' ? urlParse(params.server)
    : typeof params.server !== 'undefined' ? params.server
      : typeof options.server === 'string' ? urlParse(options.server) : options.server

  if (!params.method) {
    params.method = 'GET'
  }
  parts = underscore.extend(underscore.pick(parts, ['protocol', 'hostname', 'port']),
    underscore.omit(params, ['headers', 'payload', 'timeout']))

  if (params.useProxy) {
    if (hostLookup.hasOwnProperty(parts.hostname)) {
      parts.hostname = hostLookup[parts.hostname]
    }
  }

  const i = parts.path.indexOf('?')
  if (i !== -1) {
    parts.pathname = parts.path.substring(0, i)
    parts.search = parts.path.substring(i)
  } else {
    parts.pathname = parts.path
  }

  if (options.windowP) {
    roundTripFromWindow({url: urlFormat(parts), verboseP: options.verboseP}, callback)
    return
  }

  options = {
    url: urlFormat(parts),
    method: params.method,
    payload: params.payload,
    responseType: binaryP ? 'binary' : 'text',
    headers: underscore.defaults(params.headers || {}, {
      'content-type': 'application/json; charset=utf-8',
      'user-agent': 'Brave/FakeUserAz'
    }),
    verboseP: options.verboseP
  }
  request(options, callback, currWallet)
}

const roundTripFromWindow = (params, callback) => {
  if (!callback) {
    return
  }

  if (!params || !params.url) {
    callback(new Error('Url is missing'))
    return
  }

  fetchPublisherInfo(params.url, {
    method: 'GET',
    responseType: 'text',
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  }, (error, body) => {
    if (error) {
      return callback(error)
    }

    return callback(null, {statusCode: 200}, body)
  })
}

const fetchPublisherInfo = (url, options, callback) => {
  callback(null, {})
}

module.exports = {
  request,
  roundtrip,
  roundTripFromWindow,
  fetchPublisherInfo
}