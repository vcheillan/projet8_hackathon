const GEOSPHERE_QUERY = '/api/geosphere/maps/rest/services/IRIS/Bergbaureviere/MapServer/0/query'

const ROHSTOFF_FR = {
  'fe': 'fer', 'cu': 'cuivre', 'pb': 'plomb', 'zn': 'zinc',
  'ag': 'argent', 'au': 'or', 'ni': 'nickel', 'co': 'cobalt',
  'mn': 'manganèse', 'w': 'tungstène', 'mo': 'molybdène',
  'sn': 'étain', 'bi': 'bismuth', 'sb': 'antimoine',
  'as': 'arsenic', 'hg': 'mercure', 'ti': 'titane',
  'cr': 'chrome', 'v': 'vanadium', 'nb': 'niobium',
  'ta': 'tantale', 'li': 'lithium',
  'kohle': 'charbon', 'braunkohle': 'lignite', 'steinkohle': 'houille',
  'salz': 'sel', 'gips': 'gypse', 'quarz': 'quartz',
  'talk': 'talc', 'graphit': 'graphite',
  'magnesit': 'magnésite', 'baryt': 'barytine',
  'fluorit': 'fluorine', 'kaolin': 'kaolin',
  'ton': 'argile', 'kalk': 'calcaire', 'marmor': 'marbre',
  'erz': 'minerai', 'eisenerz': 'minerai de fer',
}

function normalise(s) {
  if (!s) return null
  const key = s.trim().toLowerCase()
  return ROHSTOFF_FR[key] || key
}

function parseSubstances(raw) {
  if (!raw) return []
  return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean).map(normalise))]
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
    const p = new URLSearchParams({ ...params, resultOffset: offset, resultRecordCount: 2000 })
    const res = await fetch(`${GEOSPHERE_QUERY}?${p}`)
    if (!res.ok) throw new Error(`GeoSphere HTTP ${res.status}`)
    const data = await res.json()
    // If server doesn't support pagination, fall back to single request
    if (data.error) {
      if (offset > 0) throw new Error(`GeoSphere API: ${data.error.message}`)
      const p2 = new URLSearchParams(params)
      const res2 = await fetch(`${GEOSPHERE_QUERY}?${p2}`)
      if (!res2.ok) throw new Error(`GeoSphere HTTP ${res2.status}`)
      const data2 = await res2.json()
      if (data2.error) throw new Error(`GeoSphere API: ${data2.error.message}`)
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

  const substances = parseSubstances(a.ROHSTOFF)

  return {
    id:          `geosphere-${a.BERGBAU_ID}`,
    name:        a.VORK_NAME || `Site ${a.BERGBAU_ID}`,
    status:      'valide',
    mineral_type: substances[0] || normalise(a.UEBERBEG) || 'inconnu',
    substances,
    domaine:     null,
    type_titre:  a.TYP || '',
    country:     'Autriche',
    region:      '',
    communes:    [],
    coordinates: coords,
    company:     null,
    surface_ha:  null,
    permits:     [String(a.BERGBAU_ID)].filter(Boolean),
    last_update: null,
    links:       a.BERGBAU_ZITATE_URL ? [{ label: 'IRIS GeoSphere', url: a.BERGBAU_ZITATE_URL }] : [],
    source:      'geosphere',
  }
}

export async function fetchGeosphereMines() {
  const features = await fetchAllPages({
    where:          "STATUS_BEZ='in Betrieb'",
    outFields:      'BERGBAU_ID,VORK_NAME,TYP,ROHSTOFF,UEBERBEG,STATUS_BEZ,BERGBAU_ZITATE_URL',
    returnGeometry: 'true',
    outSR:          '4326',
    f:              'json',
  })
  const mines = features.map(transformFeature).filter(Boolean)
  console.log(`[GeoSphere] ${features.length} features → ${mines.length} mines`)
  return mines
}
