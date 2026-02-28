import { useState, useEffect, useCallback, useMemo } from 'react'
import { FilterPanel } from './components/FilterPanel'
import { EarthquakeTable, PAGE_SIZE, FIELDS_COLUMN_CONFIG } from './components/EarthquakeTable'
import { WavWaveformPanel } from './components/WavWaveformPanel'
import { fetchEarthquakes } from './services/api'
import { getCustomField, editCustomField } from './services/customFieldApi'
import type { Earthquake, EarthquakeFilters } from './types/earthquake'
import type { Channel } from './types/channel'
import type { CustomFieldData, EditCustomFieldPayload } from './types/customField'
import { fetchChannels } from './services/channelsApi'
import './App.css'

function App() {
  const [earthquakes, setEarthquakes] = useState<Earthquake[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [channels, setChannels] = useState<Channel[]>([])
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
      timeDisplayMode: 'local',
      utcOffsetHours: '',
    };
  })
  const [velocityTarget, setVelocityTarget] = useState('1000')
  const [deltaVelocity, setDeltaVelocity] = useState('5')
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [customFieldsByCode, setCustomFieldsByCode] = useState<Record<string, CustomFieldData>>({})
  const [customFieldsLoading, setCustomFieldsLoading] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(FIELDS_COLUMN_CONFIG.map((c) => [c.key, true]))
  )

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
    ;(async () => {
      try {
        const data = await fetchChannels()
        setChannels(Array.isArray(data) ? data : [])
      } catch {
        setChannels([])
      }
    })()
  }, [])

  const selectedEarthquake = useMemo(
    () => earthquakes.find((eq) => eq.id === selectedId) ?? null,
    [earthquakes, selectedId],
  )

  useEffect(() => {
    load()
  }, []) // initial load only; Update button triggers load() with current filters

  // Fetch custom fields for current page's earthquakes that have a non-empty code
  useEffect(() => {
    if (!earthquakes.length) {
      setCustomFieldsByCode({})
      return
    }
    const start = (page - 1) * PAGE_SIZE
    const pageData = earthquakes.slice(start, start + PAGE_SIZE)
    const codes = [...new Set(pageData.map((eq) => eq.code).filter((c) => c != null && String(c).trim() !== ''))]
    if (codes.length === 0) {
      setCustomFieldsByCode({})
      return
    }
    let cancelled = false
    setCustomFieldsLoading(true)
    Promise.all(codes.map((code) => getCustomField(code)))
      .then((results) => {
        if (cancelled) return
        const next: Record<string, CustomFieldData> = {}
        results.forEach((data) => {
          if (data) next[data.code] = data
        })
        setCustomFieldsByCode(next)
      })
      .catch(() => {
        if (!cancelled) setCustomFieldsByCode({})
      })
      .finally(() => {
        if (!cancelled) setCustomFieldsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [earthquakes, page])

  const handleEditCustomField = useCallback(
    async (id: number, payload: EditCustomFieldPayload) => {
      try {
        const updated = await editCustomField(id, payload)
        setCustomFieldsByCode((prev) => ({ ...prev, [updated.code]: updated }))
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to update custom field')
      }
    },
    [load]
  )

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
        velocityTarget={velocityTarget}
        deltaVelocity={deltaVelocity}
        onVelocityChange={(v, dv) => {
          setVelocityTarget(v)
          setDeltaVelocity(dv)
        }}
        visibleColumns={visibleColumns}
        onVisibleColumnsChange={setVisibleColumns}
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
              customFieldsByCode={customFieldsByCode}
              customFieldsLoading={customFieldsLoading}
              onEditCustomField={handleEditCustomField}
              visibleColumns={visibleColumns}
              timeDisplayMode={filters.timeDisplayMode}
              utcOffsetHours={filters.utcOffsetHours}
            />
          )}
        </section>

        <section className="app-bottom" aria-label="WAV recordings waveform">
          <WavWaveformPanel
            selectedEarthquake={selectedEarthquake}
            channels={channels}
            velocityTarget={velocityTarget}
            deltaVelocity={deltaVelocity}
            utcOffsetHours={filters.utcOffsetHours}
          />
        </section>
      </div>
    </div>
  )
}

export default App
