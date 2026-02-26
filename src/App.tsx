import { useState, useEffect, useCallback } from 'react'
import { FilterPanel } from './components/FilterPanel'
import { EarthquakeTable } from './components/EarthquakeTable'
import { WavWaveformPanel } from './components/WavWaveformPanel'
import { fetchEarthquakes } from './services/api'
import type { Earthquake, EarthquakeFilters } from './types/earthquake'
import './App.css'

function App() {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<EarthquakeFilters>(() => {
    const end = new Date().toISOString().slice(0, 16);
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const startStr = start.toISOString().slice(0, 16);
    return {
      periodMode: 'last',
      lastDays: 30,
      starttime: startStr,
      endtime: end,
      minmagnitude: '2',
      maxmagnitude: '10',
      regionMode: 'all_world',
      minlatitude: '',
      maxlatitude: '',
      minlongitude: '',
      maxlongitude: '',
    };
  })
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchEarthquakes(filters)
      setEarthquakes(data.earth_quakes ?? [])
      setPage(1)
      setSelectedId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load earthquakes')
      setEarthquakes([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, []) // initial load only; Update button triggers load() with current filters

  return (
    <div className="app">
      <header className="header">
        <span className="brand">SF</span>
      </header>

      <FilterPanel
        filters={filters}
        onFiltersChange={setFilters}
        onUpdate={load}
        loading={loading}
      />

      <div className="app-split">
        <section className="app-top" aria-label="Earthquake table">
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {loading && earthquakes.length === 0 ? (
            <div className="loading">Loading…</div>
          ) : earthquakes.length === 0 ? (
            <div className="loading">No earthquakes found.</div>
          ) : (
            <EarthquakeTable
              earthquakes={earthquakes}
              page={page}
              onPageChange={setPage}
              selectedId={selectedId}
              onSelectRow={setSelectedId}
            />
          )}
        </section>

        <section className="app-bottom" aria-label="WAV recordings waveform">
          <WavWaveformPanel />
        </section>
      </div>
    </div>
  )
}

export default App
