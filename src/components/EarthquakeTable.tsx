import { useMemo } from 'react';
import type { Earthquake } from '../types/earthquake';
import { formatTimestamp, parseCommaSeparated, formatChannelDistance, formatCoord, formatDepth } from '../utils/format';

const PAGE_SIZE = 30;

type Col = {
  key: keyof Earthquake | 'date' | 'time';
  label: string;
  link?: boolean;
  fromTime?: boolean;
  pills?: boolean;
  pillsComma?: boolean;
  narrow?: boolean;
};
const TABLE_COLUMNS: Col[] = [
  { key: 'type', label: 'type', pills: true },
  { key: 'date', label: 'date', fromTime: true },
  { key: 'time', label: 'time', fromTime: true },
  { key: 'mag', label: 'mag' },
  { key: 'place', label: 'place' },
  { key: 'title', label: 'title' },
  { key: 'latitude', label: 'latitude', narrow: true },
  { key: 'longitude', label: 'longitude', narrow: true },
  { key: 'depth', label: 'depth', narrow: true },
  { key: 'url', label: 'link', link: true },
  { key: 'mmi', label: 'mmi' },
  { key: 'alert', label: 'alert', pills: true },
  { key: 'status', label: 'status', pills: true },
  { key: 'sig', label: 'sig' },
  { key: 'net', label: 'net', pills: true },
  { key: 'code', label: 'code' },
  { key: 'sources', label: 'sources', pillsComma: true },
  { key: 'types', label: 'types', pillsComma: true },
  { key: 'nst', label: 'nst' },
  { key: 'dmin', label: 'dmin' },
  { key: 'rms', label: 'rms' },
  { key: 'gap', label: 'gap' },
  { key: 'magType', label: 'magType', pills: true },
];

const PILL_VARIANTS = ['pill--teal', 'pill--amber', 'pill--violet', 'pill--rose', 'pill--sky', 'pill--emerald', 'pill--coral', 'pill--indigo'];

function pillVariant(value: string): string {
  let n = 0;
  for (let i = 0; i < value.length; i++) n = (n << 3) ^ value.charCodeAt(i);
  return PILL_VARIANTS[Math.abs(n) % PILL_VARIANTS.length];
}

function Pills({ values, muted = false }: { values: string[]; muted?: boolean }) {
  if (!values.length) return <span className="pill pill--muted">—</span>;
  return (
    <div className="pill-list">
      {values.map((v) => (
        <span key={v} className={`pill ${muted ? 'pill--muted' : pillVariant(v)}`}>
          {v}
        </span>
      ))}
    </div>
  );
}

interface EarthquakeTableProps {
  earthquakes: Earthquake[];
  page: number;
  onPageChange: (page: number) => void;
  selectedId: string | null;
  onSelectRow: (id: string | null) => void;
}

/** Collect sorted channel keys from all earthquakes (ch1, ch2, ch3, ...) */
function getChannelKeys(earthquakes: Earthquake[]): string[] {
  const set = new Set<string>();
  for (const eq of earthquakes) {
    if (eq.channel_distance && typeof eq.channel_distance === 'object') {
      for (const k of Object.keys(eq.channel_distance)) set.add(k);
    }
  }
  return Array.from(set).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '') || '0', 10);
    const numB = parseInt(b.replace(/\D/g, '') || '0', 10);
    if (numA !== numB) return numA - numB;
    return a.localeCompare(b);
  });
}

export function EarthquakeTable({
  earthquakes,
  page,
  onPageChange,
  selectedId,
  onSelectRow,
}: EarthquakeTableProps) {
  const start = (page - 1) * PAGE_SIZE;
  const pageData = earthquakes.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(earthquakes.length / PAGE_SIZE));
  const channelKeys = useMemo(() => getChannelKeys(earthquakes), [earthquakes]);

  return (
    <div className="main">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              {TABLE_COLUMNS.map(({ key, label, narrow }) => (
                <th key={key} className={narrow ? 'col--narrow' : undefined}>{label}</th>
              ))}
              {channelKeys.map((chKey) => (
                <th key={chKey} className="col--channel-dist">
                  {chKey}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageData.map((eq, i) => {
              const rowNum = start + i + 1;
              const isSelected = selectedId === eq.id;
              return (
                <tr
                  key={eq.id}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => onSelectRow(isSelected ? null : eq.id)}
                >
                  <td>{rowNum}</td>
                  {TABLE_COLUMNS.map((col) => {
                    const { key, link, fromTime, narrow } = col;
                    const tdClass = narrow ? 'col--narrow' : undefined;
                    if (fromTime && (key === 'date' || key === 'time')) {
                      const { date, time } = formatTimestamp(eq.time);
                      return <td key={col.label} className={tdClass}>{key === 'date' ? date : time}</td>;
                    }
                    if (key === 'date' || key === 'time') return null;
                    const raw = eq[key as keyof Earthquake];
                    const value = String(raw ?? '');
                    if (key === 'updated') {
                      const { date, time } = formatTimestamp(value);
                      return <td key={col.label} className={tdClass}>{date} {time}</td>;
                    }
                    if (link && (key === 'url' || key === 'detail') && value) {
                      return (
                        <td key={col.label} className={tdClass}>
                          <a href={value} target="_blank" rel="noopener noreferrer">
                            link
                          </a>
                        </td>
                      );
                    }
                    if (col.pillsComma) {
                      const tokens = parseCommaSeparated(value);
                      return (
                        <td key={col.label} className={tdClass}>
                          <Pills values={tokens} muted={tokens.length === 0} />
                        </td>
                      );
                    }
                    if (col.pills) {
                      const empty = !value || value === 'None' || value === '0';
                      return (
                        <td key={col.label} className={tdClass}>
                          <Pills values={empty ? [] : [value]} muted={empty} />
                        </td>
                      );
                    }
                    if (key === 'latitude' || key === 'longitude') {
                      return <td key={col.label} className={tdClass}>{formatCoord(value || undefined)}</td>;
                    }
                    if (key === 'depth') {
                      return <td key={col.label} className={tdClass}>{formatDepth(value || undefined)}</td>;
                    }
                    return <td key={col.label} className={tdClass}>{value || '—'}</td>;
                  })}
                  {channelKeys.map((chKey) => (
                    <td key={chKey} className="col--channel-dist">
                      {formatChannelDistance(eq.channel_distance?.[chKey])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          Previous
        </button>
        <span className="page-info">
          Page {page} of {totalPages} ({earthquakes.length} records)
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export { PAGE_SIZE };
