const GTK_LAYER = '/api/gtk/MapServer/13/query'

const GTK_STATUS_MAP = {
  'Operating':          'valide',
  'Under development':  'demande initiale',
  'Temporarily closed': 'valide',
  'Care and maintenance': 'valide',
}

// Normalize English commodity names to match Camino's French substances
const COMMODITY_FR = {
  'nickel':    'nickel',
  'copper':    'cuivre',
  'gold':      'or',
  'silver':    'argent',
  'zinc':      'zinc',
  'iron':      'fer',
  'cobalt':    'cobalt',
  'chromium':  'chrome',
  'platinum':  'platine',
  'palladium': 'palladium',
  'lead':      'plomb',
  'vanadium':  'vanadium',
  'titanium':  'titane',
  'lithium':   'lithium',
  'uranium':   'uranium',
}

function normalise(commodity) {
  if (!commodity) return null
  const key = commodity.toLowerCase().trim()
  return COMMODITY_FR[key] || key
}

function parseSubstances(main, others) {
  const raw = [
    ...(main || '').split(','),
    ...(others || '').split(','),
  ]
  return [...new Set(raw.map(s => s.trim()).filter(Boolean).map(s => normalise(s)))]
}

function transformFeature(attrs) {
  const status = GTK_STATUS_MAP[attrs.MINE_STATUS]
  if (!status) return null
  if (!attrs.LAT_WGS84 || !attrs.LON_WGS84) return null

  return {
    id: `gtk-${attrs.MINE_ID}`,
    name: attrs.MINE_NAME,
    status,
    mineral_type: normalise(attrs.MAIN_COMMODITY_MINED) || 'inconnu',
    substances: parseSubstances(attrs.MAIN_COMMODITIES_DEPOSIT, attrs.OTHER_COMMODITIES_DEPOSIT),
    country: 'Finlande',
    region: '',
    communes: [],
    coordinates: [attrs.LAT_WGS84, attrs.LON_WGS84],
    company: attrs.CURRENT_HOLDER || null,
    surface_ha: null,
    permits: [],
    last_update: attrs.DATE_UPDATED
      ? new Date(attrs.DATE_UPDATED).toISOString().slice(0, 10)
      : null,
    links: attrs.LINK_TO_DATABASE
      ? [{ label: 'GTK Mineral Database', url: attrs.LINK_TO_DATABASE }]
      : [],
    source: 'gtk',
    // GTK-specific extra fields
    mine_status_raw: attrs.MINE_STATUS,
    mining_start_year: attrs.MINING_START_YEAR,
    mining_end_year: attrs.MINING_END_YEAR,
    size_category: attrs.SIZE_BY_MAIN_COMMODITY,
    main_commodities_deposit: attrs.MAIN_COMMODITIES_DEPOSIT,
    other_commodities: attrs.OTHER_COMMODITIES_DEPOSIT,
    resources_total: attrs.RESOURCES_TOTAL,
    reserves_total: attrs.RESERVES_TOTAL,
    total_ore_mined: attrs.TOTAL_ORE_MINED,
  }
}

export async function fetchGtkMines() {
  const params = new URLSearchParams({
    where: "MINE_STATUS IN ('Operating', 'Under development', 'Temporarily closed', 'Care and maintenance')",
    outFields: '*',
    f: 'json',
  })
  const res = await fetch(`${GTK_LAYER}?${params}`)
  if (!res.ok) throw new Error(`GTK HTTP ${res.status}`)
  const data = await res.json()
  return (data.features || [])
    .map(f => transformFeature(f.attributes))
    .filter(Boolean)
}
