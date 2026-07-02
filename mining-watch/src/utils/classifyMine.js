import { METALLIC_SUBSTANCES } from '../data/mines.js'

function normalizeText(value) {
  return String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function normalizeArray(arr) {
  if (!arr) return []
  const values = Array.isArray(arr) ? arr : [arr]
  const tokens = []

  values.forEach(value => {
    if (value == null) return
    const text = normalizeText(value)
    if (!text) return

    const split = text
      .split(/[,/;|&]+|\s+et\s+|\s+\+\s+/)
      .map(part => part.replace(/[^a-z0-9\s-]/g, ' ').trim())
      .filter(Boolean)

    if (split.length > 0) {
      tokens.push(...split)
    } else {
      tokens.push(text)
    }
  })

  return Array.from(new Set(tokens.filter(Boolean)))
}

function splitTextTokens(value) {
  const normalized = normalizeText(value)
    .replace(/[-_/;|&]+/g, ' ')
    .replace(/\s+et\s+/g, ' ')
    .replace(/\s+\+\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.split(' ').filter(Boolean)
}

export function normalizeSubstances(substances) {
  return normalizeArray(substances)
}

const METAL_LOOKUP = new Set(Array.from(METALLIC_SUBSTANCES).map(normalizeText))
const METAL_PHRASES = Array.from(METAL_LOOKUP).filter(value => value.includes(' '))
const METAL_WORDS = new Set(Array.from(METAL_LOOKUP).filter(value => !value.includes(' ')))

export function hasMetalSubstance(substances) {
  return normalizeSubstances(substances).some(s => METAL_LOOKUP.has(s))
}

export function isMetalMine(mine) {
  const subs = normalizeSubstances(mine.substances || [])
  if (subs.some(s => METAL_LOOKUP.has(s))) return true

  const textPieces = [mine.name, mine.mineral_type, mine.main_commodities_deposit, mine.other_commodities, mine.type_titre]
    .filter(Boolean)

  const textTokens = new Set(textPieces.flatMap(splitTextTokens))
  if (Array.from(METAL_WORDS).some(metal => textTokens.has(metal))) return true

  const normalizedText = splitTextTokens(textPieces.join(' ')).join(' ')
  return METAL_PHRASES.some(phrase => {
    const phrasePattern = phrase.replace(/\s+/g, '\\s+')
    return new RegExp(`\\b${phrasePattern}\\b`).test(normalizedText)
  })
}

export function mapStatus(raw) {
  if (!raw) return null
  const s = String(raw).toLowerCase()
  if (s.includes('active') || s.includes('en exploitation') || s.includes('en production')) return 'mine active'
  if (s.includes('demande') || s.includes('demand')) return 'demande initiale'
  if (s.includes('valide') || s.includes('autorisation')) return 'valide'
  if (s.includes('survie') || s.includes('provisoire')) return 'valide - survie provisoire'
  return null
}

export default {
  normalizeSubstances,
  isMetalMine,
  mapStatus,
}
