const DMF_CSV = '/api/dmf/files/data/bergrettigheter.csv'

const DMF_STATUS_MAP = {
  'Godkjent':  'valide',
  'Aktiv':     'valide',
  'Gjeldende': 'valide',
}

const COMMODITY_FR_NO = {
  'jern':       'fer',
  'vanadium':   'vanadium',
  'kobber':     'cuivre',
  'sink':       'zinc',
  'bly':        'plomb',
  'gull':       'or',
  'sølv':       'argent',
  'molybden':   'molybdène',
  'wolfram':    'tungstène',
  'nikkel':     'nickel',
  'kobolt':     'cobalt',
  'titan':      'titane',
  'niob':       'niobium',
  'tantal':     'tantale',
  'kvarts':     'quartz',
  'grafitt':    'graphite',
  'fluss-spat': 'fluorine',
  'flusspat':   'fluorine',
  'apatitt':    'phosphate',
  'magnetitt':  'fer',
  'krom':       'chrome',
  'mangan':     'manganèse',
  'pyritt':     'pyrite',
  'py':         'pyrite',
  'bismut':     'bismuth',
  'antimon':    'antimoine',
  'sjeldne jordartsmetaller': 'terres rares',
  'sjeldne jordarter':        'terres rares',
  'litium':     'lithium',
  'beryllium':  'béryllium',
  'tinn':       'étain',
  'kalkstein':  'calcaire',
  'dolomitt':   'dolomite',
  'olivin':     'olivine',
  'talk':       'talc',
  'feltspat':   'feldspath',
  'glimmer':    'mica',
}

function normalise(commodity) {
  if (!commodity) return null
  const key = String(commodity).toLowerCase().trim()
  return COMMODITY_FR_NO[key] || key
}

function parseSubstances(raw) {
  if (!raw) return []
  return [...new Set(
    String(raw).split(',').map(s => s.trim()).filter(Boolean).map(normalise)
  )]
}

// Simple centroid of a POLYGON WKT (arithmetic mean of vertices)
// WKT uses (lon lat) order — we invert to [lat, lon] for the DB
function wktCentroid(wkt) {
  if (!wkt || typeof wkt !== 'string') return null
  const matches = [...wkt.matchAll(/(-?\d+\.\d+)\s+(-?\d+\.\d+)/g)]
  if (!matches.length) return null
  let sumLon = 0, sumLat = 0
  for (const [, lon, lat] of matches) {
    sumLon += parseFloat(lon)
    sumLat += parseFloat(lat)
  }
  return [sumLat / matches.length, sumLon / matches.length]
}

// Minimal CSV parser (separator `;`, no complex quoting in bergrettigheter.csv)
function parseCsv(text) {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^﻿/, '')
  const lines = clean.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(';')
  return lines.slice(1).map(line => {
    const values = line.split(';')
    return headers.reduce((obj, h, i) => {
      obj[h.trim()] = values[i]
      return obj
    }, {})
  })
}

function transformRow(row) {
  const coordinates = wktCentroid(row.Geometri)
  if (!coordinates) return null

  const status = DMF_STATUS_MAP[row.Status]
  if (!status) return null

  const substances = parseSubstances(row.Mineral)

  return {
    id:           `dmf-${row.Rettighetsnummer}`,
    name:         row.Rettighetsnavn || 'Sans nom',
    status,
    mineral_type: substances[0] || 'inconnu',
    substances,
    domaine:      null,
    type_titre:   row.Rettighetstype || '',
    country:      'Norvège',
    region:       row.Fylkesnavn || '',
    communes:     row.Kommunenavn ? row.Kommunenavn.split(',').map(s => s.trim()).filter(Boolean) : [],
    coordinates,
    company:      row.Rettighetshaver || null,
    surface_ha:   row.Areal_m2 ? Math.round(parseFloat(row.Areal_m2) / 10000) : null,
    permits:      [row.Rettighetsnummer].filter(Boolean),
    last_update:  row.Godkjent || null,
    links:        [{ label: 'Voir sur DMF', url: `https://www.dirmin.no/bergrett/${row.Rettighetsnummer}` }],
    source:       'dmf',
  }
}

export async function fetchDmfMines() {
  const res = await fetch(DMF_CSV)
  if (!res.ok) throw new Error(`DMF HTTP ${res.status}`)
  const text = await res.text()
  if (text.trimStart().startsWith('<')) throw new Error('DMF returned HTML instead of CSV — check proxy')
  const rows = parseCsv(text)
  const mines = rows.map(transformRow).filter(Boolean)
  console.log(`[DMF] ${rows.length} lignes CSV → ${mines.length} mines valides`)
  return mines
}
