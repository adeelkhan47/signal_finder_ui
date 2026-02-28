export interface Earthquake {
  id: string;
  mag: string;
  place: string;
  time: string;
  updated: string;
  tz: string;
  url: string;
  detail: string;
  felt: string;
  cdi: string;
  mmi: string;
  alert: string;
  status: string;
  tsunami: string;
  sig: string;
  net: string;
  code: string;
  ids: string;
  sources: string;
  types: string;
  nst: string;
  dmin: string;
  rms: string;
  gap: string;
  magType: string;
  type: string;
  title: string;
  longitude: string;
  latitude: string;
  depth: string;
  channel_distance?: Record<string, string>;
}

export interface EarthquakesResponse {
  earth_quakes: Earthquake[];
  count: number;
}

export type PeriodMode = 'last' | 'from_date';
export type RegionMode = 'all_world' | 'region';
export type TimeDisplayMode = 'local' | 'utc';

export interface EarthquakeFilters {
  periodMode: PeriodMode;
  lastDays: number;
  starttime: string; // YYYY-MM-DDTHH:mm for datetime-local
  endtime: string;
  minmagnitude: string;
  maxmagnitude: string;
  regionMode: RegionMode;
  minlatitude: string;
  maxlatitude: string;
  minlongitude: string;
  maxlongitude: string;
  /** Display earthquake times in local time (EQ time + UTC offset) or UTC */
  timeDisplayMode: TimeDisplayMode;
  /** UTC offset in hours to add to EQ time for local display (e.g. -5, 5.5) */
  utcOffsetHours: string;
}
