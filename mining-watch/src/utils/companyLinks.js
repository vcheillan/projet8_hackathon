const COMPANY_SITE_PATTERNS = [
  ['rio tinto', 'https://www.riotinto.com/'],
  ['bhp', 'https://www.bhp.com/'],
  ['glencore', 'https://www.glencore.com/'],
  ['vale', 'https://vale.com/'],
  ['anglo american', 'https://www.angloamerican.com/'],
  ['newmont', 'https://www.newmont.com/'],
  ['barrick', 'https://www.barrick.com/'],
  ['freeport', 'https://fmi.com/'],
  ['teck', 'https://www.teck.com/'],
  ['norilsk', 'https://www.norilsknickel.com/'],
  ['boliden', 'https://www.boliden.com/'],
  ['first quantum', 'https://www.first-quantum.com/'],
  ['lundin mining', 'https://www.lundinmining.com/'],
  ['kinross', 'https://www.kinross.com/'],
  ['southern copper', 'https://www.southerncoppercorp.com/'],
  ['equinox', 'https://www.equinoxgold.com/'],
  ['fortuna', 'https://fortunasilver.com/'],
  ['hecla', 'https://www.hecla.com/'],
  ['kumba', 'https://www.angloamerican.com/'],
  ['sibanye', 'https://www.sibanyestillwater.com/'],
  ['orla mining', 'https://orlamining.com/'],
  ['fresnillo', 'https://www.fresnilloplc.com/'],
  ['goldfields', 'https://www.goldfields.com/'],
  ['anglogold', 'https://www.anglogoldashanti.com/'],
  ['nexgen', 'https://www.nexgenenergy.ca/'],
  ['turquoise hill', 'https://www.turquoisehill.com/'],
  ['sudbury', 'https://www.sudburyinstitute.ca/'],
  ['eramet', 'https://www.eramet.com/'],
  ['srk', 'https://www.srk.com/'],
  ['tata steel', 'https://www.tatasteel.com/'],
  ['arcelormittal', 'https://corporate.arcelormittal.com/'],
  ['komatsu', 'https://www.komatsu.com/'],
  ['sandvik', 'https://www.sandvik.com/'],
  ['voestalpine', 'https://www.voestalpine.com/'],
]

function normalizeCompanyName(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const buildSearchUrl = companyName => `https://www.google.com/search?q=${encodeURIComponent(companyName)}`

export function buildCompanyLinks(companyName) {
  if (!companyName) return []
  const normalized = normalizeCompanyName(companyName)
  const matched = COMPANY_SITE_PATTERNS.find(([name]) => normalized.includes(name))
  if (matched) {
    return [{ label: `Site officiel ${companyName}`, url: matched[1] }]
  }

  return [{ label: `Rechercher ${companyName}`, url: buildSearchUrl(companyName) }]
}

function buildFallbackMineLink(mine) {
  if (mine?.company) {
    return buildCompanyLinks(mine.company)
  }
  if (mine?.name) {
    return [{ label: `Rechercher ${mine.name}`, url: `https://www.google.com/search?q=${encodeURIComponent(mine.name)}` }]
  }
  return []
}

export function enrichMineLinks(mine) {
  const existingLinks = Array.isArray(mine?.links) ? mine.links : []
  const companyLinks = buildFallbackMineLink(mine)

  const seen = new Set()
  return [...existingLinks, ...companyLinks].filter((link) => {
    if (!link?.url) return false
    const key = `${link.label || ''}::${link.url}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
