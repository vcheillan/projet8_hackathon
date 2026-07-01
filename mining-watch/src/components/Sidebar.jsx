import { useState } from 'react'
import { Search, X, ChevronDown, RefreshCw } from 'lucide-react'
import { STATUSES } from '../data/mines'

export default function Sidebar({
  searchQuery, onSearchChange,
  filters, onFiltersChange,
  availableSubstances,
  loading, error,
  onRefresh,
  onExport,
  exportCount,
}) {
  const [expanded, setExpanded] = useState({ status: true, substance: false })

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  const toggleFilter = (key, value) => {
    const current = filters[key] || []
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    onFiltersChange({ ...filters, [key]: next })
  }

  const clearFilters = () => onFiltersChange({ status: [], substance: [] })

  const activeCount = Object.values(filters).reduce((n, arr) => n + arr.length, 0)

  return (
    <aside className="w-72 h-full flex flex-col bg-white border-r border-gray-200 shrink-0">

      {/* Titre + refresh */}
      <div className="px-5 pt-5 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-gray-900 font-semibold text-base leading-none tracking-tight">Veille minière</h1>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Rafraîchir les données"
            className="p-2 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-gray-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Export CSV */}
      <div className="px-4 py-2.5 border-b border-gray-200">
        <button
          onClick={onExport}
          disabled={exportCount === 0}
          className="w-full text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 border border-gray-200 rounded px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-left"
        >
          Exporter en CSV{exportCount > 0 ? ` (${exportCount})` : ''}
        </button>
      </div>

      {/* Recherche */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Nom, substance, commune…"
            className="w-full bg-gray-50 text-gray-800 placeholder-gray-400 text-sm
                       pl-9 pr-8 py-2.5 rounded border border-gray-200
                       focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400/20
                       transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-400 uppercase tracking-widest">
            Filtres
            {activeCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                {activeCount}
              </span>
            )}
          </div>
          {activeCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
              Réinitialiser
            </button>
          )}
        </div>

        <FilterSection title="Statut" open={expanded.status} onToggle={() => toggle('status')}>
          {STATUSES.map(s => (
            <CheckItem
              key={s.value}
              label={s.label}
              checked={(filters.status || []).includes(s.value)}
              onChange={() => toggleFilter('status', s.value)}
              accentColor={s.color}
            />
          ))}
        </FilterSection>

        <FilterSection title="Substance" open={expanded.substance} onToggle={() => toggle('substance')}>
          {availableSubstances?.length > 0
            ? availableSubstances.map(s => (
                <CheckItem
                  key={s}
                  label={s}
                  checked={(filters.substance || []).includes(s)}
                  onChange={() => toggleFilter('substance', s)}
                />
              ))
            : <p className="text-xs text-gray-400 py-1">Chargement…</p>
          }
        </FilterSection>

      </div>

    </aside>
  )
}

function FilterSection({ title, open, onToggle, children }) {
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-3 pt-0.5 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

function CheckItem({ label, checked, onChange, accentColor }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer group select-none">
      <div
        onClick={onChange}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-all
          ${checked ? 'border-transparent' : 'border-gray-300 group-hover:border-gray-500'}`}
        style={checked ? { backgroundColor: accentColor || '#475569' } : {}}
      >
        {checked && (
          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l2.5 3L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className={`text-xs transition-colors ${checked ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'}`}>
        {label}
      </span>
    </label>
  )
}
