const CAMINO_API = '/api/camino/titres'

function getCentroid(geometry) {
  if (!geometry) return null
  let coords = []
  if (geometry.type === 'MultiPolygon') {
    coords = geometry.coordinates?.[0]?.[0]
  } else if (geometry.type === 'Polygon') {
    coords = geometry.coordinates?.[0]
  } else if (geometry.type === 'Point') {
    return [geometry.coordinates[1], geometry.coordinates[0]]
  }
  if (!coords?.length) return null
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length
  const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length
  return [lat, lon]
}

function transformFeature(feature) {
  const p = feature.properties
  const coordinates = getCentroid(feature.geometry)
  if (!coordinates) return null
  return {
    id: p.id,
    name: p.nom,
    status: p.statut,
    mineral_type: p.substances?.[0] || 'inconnu',
    substances: p.substances || [],
    domaine: p.domaine || '',
    type_titre: p.type || '',
    country: 'France',
    region: p.regions?.[0] || p.departements?.[0] || '',
    communes: p.communes || [],
    coordinates,
    company: p.titulaires_noms?.[0] || null,
    surface_ha: p.surface_totale || null,
    permits: p.references || [],
    last_update: null,
    links: [{ label: 'Voir sur Camino', url: `https://camino.beta.gouv.fr/titres/${p.id}` }],
  }
}

export async function fetchMines() {
  const res = await fetch(CAMINO_API)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  return (data.features || []).map(transformFeature).filter(Boolean)
}
