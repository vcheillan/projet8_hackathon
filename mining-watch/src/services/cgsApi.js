const CGS_QUERY = '/api/cgs/arcgis/rest/services/Suroviny/Surovinovy_informacni_system/MapServer/1/query'

const NEROST_FR = {
  'flammable natural gas': 'gaz naturel',
  'natural gas':           'gaz naturel',
  'crude oil':             'pétrole brut',
  'oil and gas':           'pétrole et gaz',
  'gravel-sand':           'sables et graviers',
  'sand':                  'sable',
  'gravel':                'gravier',
  'hard coal':             'houille',
  'brown coal':            'lignite',
  'lignite':               'lignite',
  'gold':                  'or',
  'silver':                'argent',
  'copper':                'cuivre',
  'zinc':                  'zinc',
  'lead':                  'plomb',
  'iron':                  'fer',
  'nickel':                'nickel',
  'cobalt':                'cobalt',
  'uranium':               'uranium',
  'lithium':               'lithium',
  'limestone':             'calcaire',
  'clay':                  'argile',
  'gypsum':                'gypse',
  'salt':                  'sel',
  'kaolin':                'kaolin',
  'graphite':              'graphite',
  'fluorite':              'fluorine',
  'talc':                  'talc',
  'silica sand':           'sable siliceux',
  'crushed stone':         'granulats',
  'sandstone':             'grès',
  'basalt':                'basalte',
  'granite':               'granite',
  'dolomite':              'dolomite',
  'quartzite':             'quartzite',
  'ceramic clay':          'argile céramique',
}

function normalise(s) {
  if (!s) return null
  const key = s.trim().toLowerCase()
  return NEROST_FR[key] || key
}

function centroid(rings) {
  const ring = rings?.[0]
  if (!ring?.length) return null
  return [
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ]
}

async function fetchAllPages(params) {
  const features = []
  let offset = 0
  while (true) {
    const p = new URLSearchParams({ ...params, resultOffset: offset, resultRecordCount: 1000 })
    const res = await fetch(`${CGS_QUERY}?${p}`)
    if (!res.ok) throw new Error(`CGS HTTP ${res.status}`)
    const data = await res.json()
    // If server doesn't support pagination, fall back to single request
    if (data.error) {
      if (offset > 0) throw new Error(`CGS API: ${data.error.message}`)
      const p2 = new URLSearchParams(params)
      const res2 = await fetch(`${CGS_QUERY}?${p2}`)
      if (!res2.ok) throw new Error(`CGS HTTP ${res2.status}`)
      const data2 = await res2.json()
      if (data2.error) throw new Error(`CGS API: ${data2.error.message}`)
      return data2.features || []
    }
    const batch = data.features || []
    features.push(...batch)
    if (!data.exceededTransferLimit || batch.length === 0) break
    offset += batch.length
  }
  return features
}

function validWGS84(coords) {
  if (!coords) return false
  const [lat, lon] = coords
  return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

function transformFeature(f) {
  const a = f.attributes
  const coords = centroid(f.geometry?.rings)
  if (!validWGS84(coords)) return null

  const substance = normalise(a.nerost)

  return {
    id:          `cgs-${a.klic}`,
    name:        a.nazev_dp || `DP ${a.klic}`,
    status:      'valide',
    mineral_type: substance || 'inconnu',
    substances:  substance ? [substance] : [],
    domaine:     null,
    type_titre:  'dobývací prostor',
    country:     'République tchèque',
    region:      '',
    communes:    [],
    coordinates: coords,
    company:     a.organizace || null,
    surface_ha:  null,
    permits:     [String(a.klic)].filter(Boolean),
    last_update: null,
    links:       [],
    source:      'cgs',
  }
}

export async function fetchCgsMines() {
  const features = await fetchAllPages({
    where:          "tezeny='Operating deposit'",
    outFields:      'klic,nazev_dp,nerost,organizace,tezeny',
    returnGeometry: 'true',
    outSR:          '4326',
    f:              'json',
  })
  const mines = features.map(transformFeature).filter(Boolean)
  console.log(`[CGS] ${features.length} features → ${mines.length} mines`)
  return mines
}
