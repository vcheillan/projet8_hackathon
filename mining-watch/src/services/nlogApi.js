// Dutch NLOG subsurface license registry (Netherlands Oil & Gas portal)
// Excludes: COAL (Staatsmijnen all closed 1970s), CO2 storage, EARTHHEAT, NITROGEN
// Keeps: SALT, HYDROCARBONS, GASOIL with active administrative status

const NLOG_LAYER = '/api/nlog/gdw_ng_licence_utm_v1/MapServer/0/query'

const EXCLUDED_RESOURCES = new Set(['COAL', 'CO2', 'EARTHHEAT', 'NITROGEN', 'HYDROCARBONS', 'GASOIL'])

const NLOG_STATUS_MAP = {
  EFFECTIVE:      'valide',
  VALID:          'valide',
  EXTENDED:       'valide - survie provisoire',
  EXTENDEDWVA:    'valide - survie provisoire',
  APPLIED:        'demande initiale',
}

const RESOURCE_FR = {
  SALT:        'sel',
  HYDROCARBONS: 'hydrocarbures',
  GASOIL:      'pétrole/gaz',
}

function centroidFromRings(rings) {
  const ring = rings?.[0]
  if (!ring?.length) return null
  const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length
  const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length
  return [lat, lon]
}

function transformFeature(feature) {
  const a = feature.attributes
  if (EXCLUDED_RESOURCES.has(a.licence_resource_cd)) return null

  const status = NLOG_STATUS_MAP[a.licence_status_cd]
  if (!status) return null

  const coordinates = centroidFromRings(feature.geometry?.rings)
  if (!coordinates) return null

  const resource = a.licence_resource_cd
  const substanceFr = RESOURCE_FR[resource] || resource?.toLowerCase()

  return {
    id:           `nlog-${a.gdnr_object_id}`,
    name:         a.licence_nm || a.licence_cd,
    status,
    mineral_type: substanceFr || 'inconnu',
    substances:   substanceFr ? [substanceFr] : [],
    domaine:      'mines',
    type_titre:   a.licence_type_cd || '',
    country:      'Pays-Bas',
    region:       a.licenced_area_nm || '',
    communes:     [],
    coordinates,
    company:      null,
    surface_ha:   null,
    permits:      a.licence_cd ? [a.licence_cd] : [],
    last_update:  null,
    links:        [],
    source:       'nlog',
    mine_status_raw:          a.licence_status_cd,
    mining_start_year:        null,
    mining_end_year:          null,
    size_category:            null,
    main_commodities_deposit: resource || null,
    other_commodities:        null,
    resources_total:          null,
    reserves_total:           null,
    total_ore_mined:          null,
  }
}

export async function fetchNlogMines() {
  // ArcGIS pagination: fetch by offsets until no more results
  const allFeatures = []
  let offset = 0
  const pageSize = 200

  while (true) {
    const params = new URLSearchParams({
      where:             "licence_status_cd IN ('EFFECTIVE','VALID','EXTENDED','EXTENDEDWVA','APPLIED')",
      outFields:         '*',
      returnGeometry:    'true',
      outSR:             '4326',
      resultRecordCount: String(pageSize),
      resultOffset:      String(offset),
      f:                 'json',
    })
    const res = await fetch(`${NLOG_LAYER}?${params}`)
    if (!res.ok) throw new Error(`NLOG HTTP ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(`NLOG API error: ${data.error.message}`)

    const features = data.features || []
    allFeatures.push(...features)

    if (!data.exceededTransferLimit || features.length < pageSize) break
    offset += pageSize
  }

  return allFeatures.map(transformFeature).filter(Boolean)
}
