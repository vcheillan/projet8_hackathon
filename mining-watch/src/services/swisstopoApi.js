const SWISS_IDENTIFY = '/api/geoswiss/rest/services/api/MapServer/identify'

const SWISS_LAYERS = [
  'ch.swisstopo.geologie-rohstoffe-kies_abbau_verarbeitung',
  'ch.swisstopo.geologie-rohstoffe-gebrochene_gesteine_abbau',
].join(',')

// Switzerland WGS84 bounding box
const BBOX = '5.96,45.83,10.49,47.81'

const STATUS_EN_MAP = {
  'in operation': 'valide',
  'in use':       'valide',
}

function transformResult(r) {
  const a = r.attributes || {}
  if (!STATUS_EN_MAP[a.stkind_en]) return null

  const lon = r.geometry?.x
  const lat = r.geometry?.y
  if (!lat || !lon || lat < 45 || lat > 48 || lon < 5 || lon > 11) return null

  const substance = a.ltkinds_fr?.toLowerCase().trim()
    || (r.layerBodId?.includes('kies') ? 'sables et graviers' : 'granulats')

  return {
    id:          `ch-${(r.layerBodId || 'x').split('.').pop()}-${r.featureId}`,
    name:        a.obname || `Site ${r.featureId}`,
    status:      'valide',
    mineral_type: substance,
    substances:  [substance].filter(Boolean),
    domaine:     null,
    type_titre:  a.emkinds_fr || '',
    country:     'Suisse',
    region:      '',
    communes:    [],
    coordinates: [lat, lon],
    company:     null,
    surface_ha:  null,
    permits:     [],
    last_update: null,
    links:       a.purl ? [{ label: 'Georessourcen ETH Zürich', url: a.purl }] : [],
    source:      'swisstopo',
  }
}

export async function fetchSwisstopoMines() {
  const params = new URLSearchParams({
    geometry:       BBOX,
    geometryType:   'esriGeometryEnvelope',
    mapExtent:      BBOX,
    imageDisplay:   '5000,5000,96',
    tolerance:      '5000',
    layers:         `all:${SWISS_LAYERS}`,
    returnGeometry: 'true',
    sr:             '4326',
    f:              'json',
  })
  const res = await fetch(`${SWISS_IDENTIFY}?${params}`)
  if (!res.ok) throw new Error(`Swisstopo HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`Swisstopo API: ${data.error.message}`)
  const results = data.results || []
  const mines = results.map(transformResult).filter(Boolean)
  console.log(`[Swisstopo] ${results.length} résultats → ${mines.length} mines`)
  return mines
}
