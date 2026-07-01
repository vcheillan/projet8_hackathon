// Swedish SGU Mineralrättsregistret (MRR)
// WFS is disabled; WMS at resource.sgu.se returns only capabilities for any request.
// Solution: (1) GetMap PNG → find colored pixels → (2) GetFeatureInfo on those pixels.

const SGU_WMS = '/api/sgu/geoserver/MRR/ows'

// Sweden WGS84 bounding box (CRS:84 = lon,lat order)
const SW_LON = 10.5, SW_LAT = 55.3
const NE_LON = 24.5, NE_LAT = 69.1

const IMG_W = 2000   // GetMap image width in pixels
const IMG_H = 2000   // GetMap image height in pixels
const SAMPLE_STEP = 4  // sample every N pixels in image analysis
const QUERY_GRID  = 120 // cluster sampled pixels into N×N cells → max query points
const BATCH = 30    // parallel GetFeatureInfo requests

// Only process concessions (metal/mineral by Swedish law) — skip oil/gas/diamond
const SGU_LAYERS = [
  {
    name:       'MRR:SE.GOV.SGU.MRR.BEARBETNINGSKONCESSIONER_APPROVED_VY',
    status:     'valide',
    type_titre: 'bearbetningskoncession',
  },
  {
    name:       'MRR:SE.GOV.SGU.MRR.BEARBETNINGSKONCESSIONER_APPLIED_VY',
    status:     'demande initiale',
    type_titre: 'bearbetningskoncession (ansökt)',
  },
  {
    name:       'MRR:SE.GOV.SGU.MRR.MINERAL_APPROVED_VY',
    status:     'demande initiale',
    type_titre: 'undersökningstillstånd — metaller/mineral',
  },
]

// Swedish mineral keywords → French substance names
const MINERAL_SE_FR = {
  'järn': 'fer', 'koppar': 'cuivre', 'zink': 'zinc', 'bly': 'plomb',
  'guld': 'or', 'silver': 'argent', 'nickel': 'nickel', 'kobolt': 'cobalt',
  'uran': 'uranium', 'titan': 'titane', 'krom': 'chrome', 'mangan': 'manganèse',
  'molybden': 'molybdène', 'volfram': 'tungstène', 'litium': 'lithium',
  'niob': 'niobium', 'vanadin': 'vanadium', 'selen': 'sélénium',
  'tellur': 'tellure', 'indium': 'indium', 'gallium': 'gallium',
  'skandium': 'scandium', 'vismut': 'bismuth', 'antimon': 'antimoine',
  'arsenik': 'arsenic', 'kvicksilver': 'mercure', 'tenn': 'étain',
  'platina': 'platine', 'palladium': 'palladium',
}

function parseMineral(rawMineral) {
  if (!rawMineral) return ['minerai']
  const lower = rawMineral.toLowerCase()
  const found = new Set()
  for (const [sv, fr] of Object.entries(MINERAL_SE_FR)) {
    if (lower.includes(sv)) found.add(fr)
  }
  return found.size ? [...found] : ['minerai']
}

function centroid(geometry) {
  if (!geometry) return null
  if (geometry.type === 'Point') return [geometry.coordinates[1], geometry.coordinates[0]]
  const ring = geometry.type === 'MultiPolygon'
    ? geometry.coordinates?.[0]?.[0]
    : geometry.coordinates?.[0]
  if (!ring?.length) return null
  return [
    ring.reduce((s, p) => s + p[1], 0) / ring.length,
    ring.reduce((s, p) => s + p[0], 0) / ring.length,
  ]
}

function transformFeature(f, layerDef) {
  const p = f.properties || {}
  const diaryNr = p['Diary nr'] || p['diary_nr'] || p['DIARY_NR'] || p['identitetsnummer']
  const name    = p['Name']    || p['name']    || p['namn']
  if (!diaryNr && !name) return null

  const rawId = diaryNr || name
  const coords = centroid(f.geometry)
  if (!coords) return null

  const substances = parseMineral(p['Mineral'] || p['mineral'])
  const areaStr    = p['Area']   || p['area']   || ''
  const area_ha    = areaStr ? parseFloat(areaStr.replace(',', '.')) : null

  return {
    id:           `sgu-${String(rawId).replace(/\s+/g, '-')}`,
    name:         name || `Concession ${rawId}`,
    status:       layerDef.status,
    mineral_type: substances[0] || 'minerai',
    substances,
    domaine:      'mines',
    type_titre:   layerDef.type_titre,
    country:      'Suède',
    region:       p['County']       || p['county']       || '',
    communes:     p['Municipality'] ? [p['Municipality']] : [],
    coordinates:  coords,
    company:      p['Owner']        || p['owner']        || null,
    surface_ha:   isNaN(area_ha)    ? null : area_ha,
    permits:      [String(rawId)],
    last_update:  p['Valid to']     || p['valid_to']     || null,
    links:        [],
    source:       'sgu',
    mine_status_raw: p['Status'] || p['status'] || null,
  }
}

// Load a WMS GetMap PNG into a canvas and return pixel data
function loadGetMapPixels(layerName) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap',
      LAYERS: layerName,
      CRS: 'CRS:84',
      BBOX: `${SW_LON},${SW_LAT},${NE_LON},${NE_LAT}`,
      WIDTH: IMG_W, HEIGHT: IMG_H,
      FORMAT: 'image/png',
      TRANSPARENT: 'true',
      STYLES: '',
    })

    const img = new Image()
    // No crossOrigin: image served via same-origin Vite proxy → no CORS check needed
    // Setting crossOrigin='anonymous' would force CORS and fail since SGU doesn't send
    // Access-Control-Allow-Origin, causing getImageData() to throw SecurityError.
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width  = IMG_W
        canvas.height = IMG_H
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, IMG_W, IMG_H)
        resolve(ctx.getImageData(0, 0, IMG_W, IMG_H).data)
      } catch (e) {
        console.warn('[SGU] Canvas getImageData failed:', e.message)
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = `${SGU_WMS}?${params}`
  })
}

function buildFeatureInfoUrl(layerName, pixelX, pixelY) {
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetFeatureInfo',
    LAYERS:       layerName,
    QUERY_LAYERS: layerName,
    CRS:          'CRS:84',
    BBOX:         `${SW_LON},${SW_LAT},${NE_LON},${NE_LAT}`,
    WIDTH:        IMG_W,
    HEIGHT:       IMG_H,
    I:            pixelX,
    J:            pixelY,
    INFO_FORMAT:  'application/json',
    FEATURE_COUNT: 50,
  })
  return `${SGU_WMS}?${params}`
}

async function sampleLayer(layerDef) {
  const seen = new Map()

  // --- Step 1: get the PNG and find colored pixels ---
  const pixelData = await loadGetMapPixels(layerDef.name)

  let queryPoints
  if (pixelData) {
    // Collect non-transparent pixels into QUERY_GRID×QUERY_GRID buckets
    const cellW = IMG_W / QUERY_GRID
    const cellH = IMG_H / QUERY_GRID
    const buckets = new Map() // "cx,cy" → {x,y} of first colored pixel in bucket

    for (let py = 0; py < IMG_H; py += SAMPLE_STEP) {
      for (let px = 0; px < IMG_W; px += SAMPLE_STEP) {
        const idx = (py * IMG_W + px) * 4
        if (pixelData[idx + 3] > 128) { // non-transparent
          const key = `${Math.floor(px / cellW)},${Math.floor(py / cellH)}`
          if (!buckets.has(key)) buckets.set(key, { x: px, y: py })
        }
      }
    }

    queryPoints = [...buckets.values()]
    console.log(`[SGU] ${layerDef.name.split('.').pop()}: ${queryPoints.length} query points from image`)
  } else {
    // Fallback: uniform 30×30 grid if image loading fails
    queryPoints = []
    const step = Math.floor(IMG_W / 30)
    for (let py = step / 2; py < IMG_H; py += step) {
      for (let px = step / 2; px < IMG_W; px += step) {
        queryPoints.push({ x: Math.round(px), y: Math.round(py) })
      }
    }
    console.warn(`[SGU] Image load failed for ${layerDef.name}, using fallback grid`)
  }

  // --- Step 2: GetFeatureInfo at each query point ---
  for (let i = 0; i < queryPoints.length; i += BATCH) {
    const slice = queryPoints.slice(i, i + BATCH)
    const results = await Promise.allSettled(
      slice.map(({ x, y }) =>
        fetch(buildFeatureInfoUrl(layerDef.name, Math.round(x), Math.round(y)))
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
      )
    )
    for (const res of results) {
      if (res.status !== 'fulfilled' || !res.value) continue
      for (const feature of (res.value.features || [])) {
        const mine = transformFeature(feature, layerDef)
        if (mine && !seen.has(mine.id)) seen.set(mine.id, mine)
      }
    }
    // Small pause between batches to avoid rate-limiting
    if (i + BATCH < queryPoints.length) await new Promise(r => setTimeout(r, 80))
  }

  return [...seen.values()]
}

export async function fetchSguMines() {
  const results = await Promise.allSettled(SGU_LAYERS.map(sampleLayer))
  const all = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])

  // Dedup across layers (applied→approved transition)
  const unique = [...new Map(all.map(m => [m.id, m])).values()]
  console.log(`[SGU] ${unique.length} mines/permis suédois`)
  return unique
}
