let { awsjson, buildXML, getEndpointParams, tidyQuery, validateProtocol, AwsJSONContentType, XMLContentType } = require('../lib')
let { globalServices, semiGlobalServices } = require('../lib/services')
let { is } = require('../lib/validate')
let request = require('./request')

/* istanbul ignore next */
let copy = obj => JSON.parse(JSON.stringify(obj))


module.exports = async function _request (params, creds, region, config, metadata) {
  /* istanbul ignore next: TODO remove + test */
  if ((params.paginator?.default === 'enabled' && params.paginate !== false) ||
      (params.paginator && params.paginate)) {
    return await paginator(params, creds, region, config, metadata)
  }
  return await makeRequest(params, creds, region, config, metadata)
}

async function makeRequest (params, creds, region, config, metadata) {
  let overrides = getEndpointParams(params)
  let protocol =    overrides.protocol    || config.protocol
  let host =        overrides.host        || config.host
  let port =        overrides.port        || config.port
  let pathPrefix =  overrides.pathPrefix  || config.pathPrefix
  let path =        params.path           || ''

  // Final validation, remove aliases, etc.
  validateProtocol(protocol)
  /* istanbul ignore next */
  if (params.endpoint) delete params.endpoint
  /* istanbul ignore next */
  if (params.hostname) delete params.hostname

  // Path
  // Note: params.path may also be passed if the request is coming from a plugin that pre-signed with aws4
  if (path && !path.startsWith('/')) {
    path = '/' + path
  }
  if (pathPrefix) {
    path = pathPrefix + path
  }
  path = (path || '/').replace(/[\/]{2,}/g, '/') // 2+ slashes reduce to one

  // Structured query string
  if (params.query) {
    if (!is.object(params.query)) {
      throw ReferenceError('Query property must be an object')
    }
    let query = tidyQuery(params.query)
    if (query) {
      // Expect aws4 to handle RFC 3986 encoding when appending the query string to the passed path
      path += '?' + query
    }
  }

  // Headers, content-type
  let headers = params.headers || {}
  let contentType = headers['content-type'] || headers['Content-Type'] || ''
  /* istanbul ignore next */
  if (headers['Content-Type']) delete headers['Content-Type']

  // Body - JSON-ify payload where convenient! Leave raw where needed
  let body = params.payload || params.body || params.data
  let isBuffer = body instanceof Buffer
  let isStream = is.stream(body)

  // Detecting objects leaves open the possibility of some weird valid JSON (like just a null), deal with it if / when we need to I guess
  if (typeof body === 'object' && !isBuffer && !isStream) {
    // Backfill content-type if it's just an object
    if (!contentType) contentType = 'application/json'

    if (XMLContentType(contentType)) {
      params.body = buildXML(body)
    }
    else {
      // A variety of services use AWS JSON; we'll make it easier via a header or passed param
      // Allow for manual encoding by passing a header while setting awsjson to false
      let awsjsonEncode = params.awsjson ||
                            (AwsJSONContentType(contentType) && params.awsjson !== false)
      if (awsjsonEncode) {
        // Backfill content-type header yet again
        if (!AwsJSONContentType(contentType)) {
          contentType = 'application/x-amz-json-1.0'
        }
        body = awsjson.marshall(body, params.awsjson)
      }
      // Final JSON encoding
      params.body = JSON.stringify(body)
    }
  }
  // Everything besides streams pass through for signing
  else {
    params.body = isStream ? undefined : body
  }

  // Finalize headers, content-type
  if (contentType) {
    headers['content-type'] = contentType
  }
  // aws4's default content-type is form-urlencoded: backfill if there's a (non-streaming) body, yet no content-type was specified
  // We don't want aws4 to attempt to sign stream objects, so if we backfill this content-type on a stream, the signature breaks and auth will fail
  else if (params.body) {
    headers['content-type'] = 'application/octet-stream'
  }
  params.headers = headers

  // Sign the payload; let aws4 handle (most) logic related to region + service instantiation
  let signing = { region, ...params, protocol, host, port, pathPrefix, path }

  /* istanbul ignore next */
  if (globalServices.includes(params.service)) {
    // If it's semi-global and the region is not us-east-1, leave the region in
    // Otherwise, exclude the region from the signed headers
    let isSemiGlobal = semiGlobalServices.includes(params.service)
    if (!isSemiGlobal || (isSemiGlobal && region === 'us-east-1')) {
      delete signing.region // jic the user specified it per-request
    }
  }

  let stream = isStream ? body : undefined
  return await request(params, { creds, config, metadata, signing, stream })
}

let validPaginationTypes = [ 'payload', 'query' ]
/* istanbul ignore next */
async function paginator (params, creds, region, config, metadata) {
  let { debug } = config
  let { type, cursor, token, accumulator } = params.paginator
  let nestedAccumulator = accumulator.split('.').length > 1

  if (!cursor || typeof cursor !== 'string') {
    throw ReferenceError(`aws-lite paginator requires a cursor property name (string)`)
  }
  if (!token || typeof token !== 'string') {
    throw ReferenceError(`aws-lite paginator requires a token property name (string)`)
  }
  if (!accumulator || typeof accumulator !== 'string') {
    throw ReferenceError(`aws-lite paginator requires an accumulator property name (string)`)
  }
  if (type && !validPaginationTypes.includes(type)) {
    throw ReferenceError(`aws-lite paginator type must be one of: ${validPaginationTypes.join(', ')}`)
  }

  // aws4 has a lot of options, so our request() method mutates the passed params and just signs the whole thing
  // That's normally fine! But we need to start from a fresh copy of the original headers each time, or content-length, auth, etc. will be passed by reference, and may get borked across multiple sequential requests
  let originalHeaders = copy(params.headers || {})
  let page = 1
  let items = []
  let statusCode, headers
  async function get () {
    let result = await makeRequest(
      { ...params, headers: copy(originalHeaders) },
      creds, region, config, metadata
    )
    if (!result.payload) {
      throw ReferenceError('Pagination error: missing API response')
    }
    if (typeof result.payload !== 'object') {
      throw ReferenceError('Pagination error: response must be valid JSON or XML')
    }

    let accumulated = nestedAccumulator
      ? accumulator.split('.').reduce((parent, child) => parent?.[child], result.payload)
      // Some responses omit their accumulator property if empty (eg S3 ListObjectsV2...), so backfill it as necessary
      : result.payload[accumulator] || []

    // Best effort handling of properties that sometimes are / are not arrays, courtesy of XML
    // This can perhaps backfire in a few different ways, so hold onto your butts
    if (accumulated && !Array.isArray(accumulated)) {
      accumulated = [ accumulated ]
    }

    // Update statusCode and headers for response hooks
    statusCode = result.statusCode
    headers = result.headers

    // Exit if we're out of results
    if (!accumulated.length) {
      return
    }

    // Some services will just keep re-sending the final page with the final token
    // Exit here to prevent infinite loops if cursors match
    if (result.payload[token] && (type === 'payload' || !type) &&
        result.payload[token] === params.payload[cursor]) {
      return
    }
    if (result.payload[token] && (type === 'query') &&
        result.payload[token] === params.query[cursor]) {
      return
    }

    items.push(...accumulated)
    if (result.payload[token]) {
      if (type === 'payload' || !type) {
        params.payload[cursor] = result.payload[token]
      }
      if (type === 'query') {
        params.query = params.query || {}
        params.query[cursor] = result.payload[token]
      }
      page++
      if (debug) console.error(`[aws-lite] Paginator: getting page ${page}`)
      await get()
    }
  }
  await get()
  if (nestedAccumulator) {
    return { statusCode, headers, payload: reNestAccumulated(accumulator, items) }
  }
  return { statusCode, headers, payload: { [accumulator]: items } }
}

/* istanbul ignore next */
function reNestAccumulated (acc, items) {
  acc = Array.isArray(acc) ? acc : acc.split('.')
  if (!acc.length) return items
  return { [acc.shift()]: reNestAccumulated(acc, items) }
}
