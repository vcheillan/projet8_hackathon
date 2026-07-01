const IGME_QUERY = '/api/igme/gis/rest/services/BasesDatos/IGME_BDMIN_Explotaciones/MapServer/0/query'

const STATUS_MAP_ES = {
  'Activa continua':     'valide',
  'Activa intermitente': 'valide',
  'Activa discontinua':  'valide',
  'Activa estacional':   'valide',
  'En rehabilitación':   'valide',
  'En proyecto':         'demande initiale',
  'En tramitación':      'demande initiale',
}

const SUSTANCIA_FR = {
  'peridotita': 'péridotite', 'caliza': 'calcaire', 'pizarra': 'ardoise',
  'granito': 'granite', 'cuarzo': 'quartz', 'hierro': 'fer',
  'cobre': 'cuivre', 'zinc': 'zinc', 'plomo': 'plomb',
  'oro': 'or', 'plata': 'argent', 'carbón': 'charbon', 'carbon': 'charbon',
  'sal': 'sel', 'fosfato': 'phosphate', 'feldespato': 'feldspath',
  'caolín': 'kaolin', 'kaolin': 'kaolin', 'arcilla': 'argile',
  'yeso': 'gypse', 'talco': 'talc', 'fluorita': 'fluorine',
  'barita': 'barytine', 'magnesita': 'magnésite',
  'wolframio': 'tungstène', 'molibdeno': 'molybdène',
  'titanio': 'titane', 'manganeso': 'manganèse',
  'mercurio': 'mercure', 'estaño': 'étain', 'antimonio': 'antimoine',
  'arsénico': 'arsenic', 'cobalto': 'cobalt', 'níquel': 'nickel',
  'litio': 'lithium', 'niobio': 'niobium', 'tántalo': 'tantale',
  'gneis': 'gneiss', 'esquistos': 'schiste', 'mármol': 'marbre',
  'dolomita': 'dolomite', 'arenisca': 'grès', 'arena': 'sable',
  'grava': 'gravier', 'lignito': 'lignite', 'antracita': 'anthracite',
}

function normalise(s) {
  if (!s) return null
  const key = s.trim().toLowerCase()
  return SUSTANCIA_FR[key] || key
}

function parseSubstances(raw) {
  if (!raw) return []
  return [...new Set(raw.split(',').map(s => s.trim()).filter(Boolean).map(normalise))]
}

// Spain split into a grid — IGME limits to 1000 records per request with no pagination support
const SPAIN_BOXES = [
  '-9.5,42.5,  -5.0,44.0', // Galice / Asturies
  '-5.0,42.5,   4.5,44.0', // Cantabrie / Pays Basque / Catalogne Nord
  '-9.5,39.0,  -4.0,42.5', // Castille-Léon / Estrémadure Nord
  '-4.0,39.0,   4.5,42.5', // Aragon / Catalogne / Levant Nord
  '-9.5,35.9,  -4.0,39.0', // Estrémadure Sud / Andalousie Ouest
  '-4.0,35.9,   4.5,39.0', // Andalousie Est / Levant Sud / Murcie
  '-18.5,27.5,-13.0,29.5', // Canaries
].map(b => b.replace(/\s/g, ''))

async function fetchBox(bbox) {
  const p = new URLSearchParams({
    where:          '1=1',
    outFields:      'Codigo_roca,Sustancia,Provincia,Municipio,Estado_Explotacion,Forma_Explotacion,Usos',
    returnGeometry: 'true',
    geometry:       bbox,
    geometryType:   'esriGeometryEnvelope',
    inSR:           '4326',
    f:              'json',
  })
  const res = await fetch(`${IGME_QUERY}?${p}`)
  if (!res.ok) throw new Error(`IGME HTTP ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`IGME API: ${data.error.message}`)
  return data.features || []
}

async function fetchAllPages() {
  const batches = await Promise.all(SPAIN_BOXES.map(fetchBox))
  const seen = new Set()
  const features = []
  for (const batch of batches) {
    for (const f of batch) {
      const key = f.attributes?.Codigo_roca
      if (key && !seen.has(key)) { seen.add(key); features.push(f) }
    }
  }
  return features
}

function centroid(rings) {
  const ring = rings?.[0]
  if (!ring?.length) return null
  return [
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ]
}

function transformFeature(f) {
  const a = f.attributes
  const status = STATUS_MAP_ES[a.Estado_Explotacion]
  if (!status) return null

  const g = f.geometry
  let lat, lon
  if (g?.x != null && g?.y != null) {
    // Point
    lat = g.y; lon = g.x
  } else if (g?.rings) {
    // Polygon — compute centroid
    const c = centroid(g.rings)
    if (!c) return null
    ;[lat, lon] = c
  } else {
    return null
  }

  const substances = parseSubstances(a.Sustancia)
  const typeLabel = [a.Forma_Explotacion, a.Usos].filter(Boolean).join(' — ')
  const mainSubstance = substances[0]

  return {
    id:          `igme-${a.Codigo_roca}`,
    name:        mainSubstance
                   ? `${mainSubstance.charAt(0).toUpperCase() + mainSubstance.slice(1)} — ${a.Municipio || a.Provincia || 'Espagne'}`
                   : `Exploitation ${a.Codigo_roca}`,
    status,
    mineral_type: mainSubstance || 'inconnu',
    substances,
    domaine:     null,
    type_titre:  typeLabel || '',
    country:     'Espagne',
    region:      a.Provincia || '',
    communes:    a.Municipio ? [a.Municipio] : [],
    coordinates: [lat, lon],
    company:     null,
    surface_ha:  null,
    permits:     [a.Codigo_roca].filter(Boolean),
    last_update: null,
    links:       [],
    source:      'igme',
  }
}

export async function fetchIgmeMines() {
  const features = await fetchAllPages()
  const mines = features.map(transformFeature).filter(Boolean)
  console.log(`[IGME] ${features.length} features → ${mines.length} mines`)
  return mines
}
