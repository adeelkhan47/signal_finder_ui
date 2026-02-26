import type { EarthquakesResponse, EarthquakeFilters } from '../types/earthquake';
import { toApiDateTime, lastDaysToRange } from '../utils/format';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

function buildRequestBody(filters: EarthquakeFilters): Record<string, string | number> {
  const { periodMode, lastDays, starttime, endtime, regionMode, minlatitude, maxlatitude, minlongitude, maxlongitude } = filters;
  let starttimeStr: string;
  let endtimeStr: string;
  if (periodMode === 'last') {
    const range = lastDaysToRange(lastDays);
    starttimeStr = range.starttime;
    endtimeStr = range.endtime;
  } else {
    starttimeStr = toApiDateTime(starttime);
    endtimeStr = toApiDateTime(endtime);
  }

  const hasRegion = !!(minlatitude || maxlatitude || minlongitude || maxlongitude);
  const body: Record<string, string | number> = {
    starttime: starttimeStr || '2026-01-15 00:00:00',
    endtime: endtimeStr || '2026-01-20 00:00:00',
    minmagnitude: filters.minmagnitude ?? '3',
    maxmagnitude: filters.maxmagnitude ?? '6',
    region: regionMode === 'region' && hasRegion ? 'region' : 'world',
  };

  if (regionMode === 'region' && hasRegion) {
    body.minlatitude = minlatitude;
    body.maxlatitude = maxlatitude;
    body.minlongitude = minlongitude;
    body.maxlongitude = maxlongitude;
  }

  return body;
}

export async function fetchEarthquakes(
  filters: EarthquakeFilters
): Promise<EarthquakesResponse> {
  const url = `${API_BASE}/earthquake/create`;
  const body = buildRequestBody(filters);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as EarthquakesResponse;
  return {
    earth_quakes: data.earth_quakes ?? [],
    count: data.count ?? (data.earth_quakes?.length ?? 0),
  };
}
