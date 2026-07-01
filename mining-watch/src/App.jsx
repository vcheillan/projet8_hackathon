import { useState, useMemo, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import MapView from './components/MapView'
import MineDetailPanel from './components/MineDetailPanel'
import { loadMinesFromDb, syncFromApis } from './services/syncMines'
import { METALLIC_SUBSTANCES, KNOWN_STATUSES } from './data/mines'

export default function App() {
  const [mines, setMines] = useState([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [selectedMine, setSelectedMine] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ status: [], substance: [] })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadMinesFromDb()
      setMines(data)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncFromApis()
    } catch (e) {
      setError(e.message)
    } finally {
      await load()
      setSyncing(false)
    }
  }, [load])

  useEffect(() => { load() }, [load])

  // Pré-filtrage : uniquement les mines métalliques avec un statut connu
  const metalMines = useMemo(() => mines.filter(mine => {
    if (!KNOWN_STATUSES.has(mine.status)) return false
    return mine.substances.some(s => METALLIC_SUBSTANCES.has(s))
      || METALLIC_SUBSTANCES.has(mine.mineral_type)
  }), [mines])

  const availableSubstances = useMemo(() => {
    const set = new Set()
    metalMines.forEach(m => m.substances.filter(s => METALLIC_SUBSTANCES.has(s)).forEach(s => set.add(s)))
    return [...set].sort()
  }, [metalMines])

  const filteredMines = useMemo(() => {
    return metalMines.filter(mine => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const hit =
          mine.name.toLowerCase().includes(q) ||
          (mine.company || '').toLowerCase().includes(q) ||
          (mine.region || '').toLowerCase().includes(q) ||
          mine.substances.some(s => s.toLowerCase().includes(q)) ||
          mine.communes.some(c => c.toLowerCase().includes(q))
        if (!hit) return false
      }
      if (filters.status.length && !filters.status.includes(mine.status)) return false
      if (filters.substance.length && !mine.substances.some(s => filters.substance.includes(s))) return false
      return true
    })
  }, [metalMines, searchQuery, filters])

  const handleExport = useCallback(() => {
    const headers = ['Nom', 'Statut', 'Région', 'Titulaire', 'Surface (ha)', 'Type de titre', 'Domaine', 'Substances', 'Communes']
    const rows = filteredMines.map(m => [
      m.name,
      m.status,
      m.region || '',
      m.company || '',
      m.surface_ha != null ? m.surface_ha : '',
      m.type_titre || '',
      m.domaine || '',
      m.substances.join(' | '),
      m.communes.join(' | '),
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mines_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filteredMines])

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        filters={filters}
        onFiltersChange={setFilters}
        resultCount={filteredMines.length}
        totalCount={metalMines.length}
        availableSubstances={availableSubstances}
        loading={loading || syncing}
        error={error}
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        onExport={handleExport}
        exportCount={filteredMines.length}
      />

      <div className="flex-1 relative overflow-hidden">
        {loading && mines.length === 0 && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-gray-50/95 gap-3">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">{syncing ? 'Synchronisation des APIs…' : 'Chargement depuis la base de données…'}</p>
          </div>
        )}
        {error && mines.length === 0 && (
          <div className="absolute inset-0 z-[2000] flex flex-col items-center justify-center bg-gray-50/95 gap-3">
            <p className="text-red-500 text-sm">Erreur : {error}</p>
            <button
              onClick={load}
              className="px-4 py-2 text-xs rounded-lg bg-gray-100 border border-gray-300 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Réessayer
            </button>
          </div>
        )}
        <MapView
          mines={filteredMines}
          selectedMine={selectedMine}
          onMineSelect={m => setSelectedMine(prev => prev?.id === m.id ? null : m)}
        />
        <MineDetailPanel mine={selectedMine} onClose={() => setSelectedMine(null)} />
      </div>
    </div>
  )
}
