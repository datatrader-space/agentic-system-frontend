export function hydrateMediaNode(data = {}) {
  return { ...data, params_json: JSON.stringify(data.params || {}, null, 2), references_json: JSON.stringify(data.references || [], null, 2), cinema_json: JSON.stringify(data.cinema || {}, null, 2) }
}
export function serializeMediaNode(data = {}) {
  const { params_json, references_json, cinema_json, __status, __error, ...rest } = data
  const parse = (text, fallback, array, name) => {
    const value = text === undefined ? fallback : JSON.parse(text || (array ? '[]' : '{}'))
    if (!value || typeof value !== 'object' || Array.isArray(value) !== array) throw Error(`${name} must be ${array ? 'an array' : 'an object'}.`)
    return value
  }
  rest.params = parse(params_json, rest.params || {}, false, 'Parameters')
  rest.references = parse(references_json, rest.references || [], true, 'References')
  if (rest.operation === 'video') rest.cinema = parse(cinema_json, rest.cinema || {}, false, 'Cinema')
  else delete rest.cinema
  return rest
}
