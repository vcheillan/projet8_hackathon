// Polish MIDAS layer 1 — active mining concessions (obszary górnicze), all minerals.
// Source: PGI-NRI / cbdgmapa.pgi.gov.pl

const MIDAS_LAYER = '/api/midas/MapServer/1/query'

const KOPALINA_FR = {
  // métaux — formes complètes et combinées (ex. KGHM: 'rudy miedzi i srebra')
  'rudy miedzi':              'cuivre',
  'rudy miedzi i srebra':     'cuivre',
  'rudy cynku':               'zinc',
  'rudy ołowiu':              'plomb',
  'rudy cynku i ołowiu':      'zinc-plomb',
  'rudy cynku, ołowiu i srebra': 'zinc-plomb',
  'rudy żelaza':              'fer',
  'rudy niklu':               'nickel',
  'rudy złota':               'or',
  'rudy arsenu':              'arsenic',
  'rudy cyny':                'étain',
  'rudy chromu':              'chrome',
  'rudy kobaltu':             'cobalt',
  'rudy molibdenu':           'molybdène',
  'rudy wanadu':              'vanadium',
  'rudy tytanu':              'titane',
  'rudy manganu':             'manganèse',
  'rudy uranu':               'uranium',
  'rudy litu':                'lithium',
  // tokens polonais seuls (quand 'i' est séparateur)
  'srebra':    'argent',
  'srebro':    'argent',
  'złoto':     'or',
  'miedź':     'cuivre',
  'cynku':     'zinc',
  'ołowiu':    'plomb',
  'żelaza':    'fer',
  'niklu':     'nickel',
  'kobaltu':   'cobalt',
  'uranu':     'uranium',
  'litu':      'lithium',
  // charbon
  'węgiel kamienny':    'houille',
  'węgiel brunatny':    'lignite',
  'antracyt':           'anthracite',
  // sels et évaporites
  'sól kamienna':       'sel',
  'sól potasowo-magnezowa': 'sel de potasse',
  'anhydryt':           'anhydrite',
  'gips':               'gypse',
  // autres minéraux industriels
  'siarka':             'soufre',
  'siarki':             'soufre',
  'fosforyty':          'phosphate',
  'baryt':              'barytine',
  'fluoryt':            'fluorine',
  'talk':               'talc',
  'grafit':             'graphite',
  'kaolin':             'kaolin',
  // granulats et roches
  'piaski i żwiry':     'sables et graviers',
  'piaski':             'sable',
  'żwiry':              'gravier',
  'wapienie':           'calcaire',
  'wapień':             'calcaire',
  'dolomity':           'dolomite',
  'dolomit':            'dolomite',
  'granit':             'granite',
  'bazalt':             'basalte',
  'piaskowiec':         'grès',
  'łupki':              'ardoise',
  'gliny':              'argile',
  'iły':                'argile',
  'kreda':              'craie',
  'margle':             'marne',
  // hydrocarbures
  'gaz ziemny':         'gaz naturel',
  'ropa naftowa':       'pétrole',
  'metan z pokładów węgla': 'méthane houiller',
}

function parseSubstances(kopalina) {
  if (!kopalina) return []
  // Try full string first (handles 'rudy miedzi i srebra' as a unit)
  const full = kopalina.trim().toLowerCase()
  if (KOPALINA_FR[full]) return [KOPALINA_FR[full]]
  // Split on commas and Polish 'i' (= "et") then translate each token
  const parts = full.split(/[,/]|\s+i\s+/).map(s => s.trim()).filter(Boolean)
  return [...new Set(parts.map(k => KOPALINA_FR[k] || k).filter(Boolean))]
}

function centroidFromRings(rings) {
  const ring = rings?.[0]
  if (!ring?.length) return null
  return [
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ]
}

function msToDate(ms) {
  if (!ms) return null
  const d = new Date(ms)
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function transformFeature(feature) {
  const a = feature.attributes
  if (a.STATUS !== 'aktualny') return null

  const substances = parseSubstances(a.KOPALINA)

  const coordinates = centroidFromRings(feature.geometry?.rings)
  if (!coordinates) return null

  return {
    id:           `midas-og-${a.ID_KONTURU}`,
    name:         a.NAZWA_OG || a.NAZWA_ZLOZA || `Concession ${a.ID_KONTURU}`,
    status:       'valide',
    mineral_type: substances[0],
    substances,
    domaine:      'mines',
    type_titre:   'concession minière',
    country:      'Pologne',
    region:       a.WYD_WYZN || '',
    communes:     [],
    coordinates,
    company:      a.NADZOR_OUG || null,
    surface_ha:   a.POWIERZCHNIA ? Math.round(a.POWIERZCHNIA / 10000) : null,
    permits:      a.NR_REJESTR ? [a.NR_REJESTR] : [],
    last_update:  msToDate(a.DATA_USTANOWIENIA),
    links:        [],
    source:       'midas-og',
    mine_status_raw:          a.STATUS,
    mining_start_year:        a.DATA_USTANOWIENIA ? new Date(a.DATA_USTANOWIENIA).getFullYear() : null,
    mining_end_year:          a.DATA_WAZNOSCI ? new Date(a.DATA_WAZNOSCI).getFullYear() : null,
    size_category:            null,
    main_commodities_deposit: a.KOPALINA || null,
    other_commodities:        null,
    resources_total:          null,
    reserves_total:           null,
    total_ore_mined:          null,
  }
}

export async function fetchMidasMines() {
  const params = new URLSearchParams({
    where:          "STATUS = 'aktualny'",
    outFields:      '*',
    returnGeometry: 'true',
    outSR:          '4326',
    f:              'json',
  })
  const res = await fetch(`${MIDAS_LAYER}?${params}`)
  if (!res.ok) throw new Error(`MIDAS-OG HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`MIDAS-OG API: ${data.error.message}`)
  return (data.features || []).map(transformFeature).filter(Boolean)
}
