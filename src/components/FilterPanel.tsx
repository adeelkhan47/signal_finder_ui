import { useState } from 'react';
import type { EarthquakeFilters, PeriodMode, RegionMode } from '../types/earthquake';
import { ChannelsDialog } from './ChannelsDialog';

interface FilterPanelProps {
  filters: EarthquakeFilters;
  onFiltersChange: (f: EarthquakeFilters) => void;
  onUpdate: () => void;
  loading?: boolean;
  velocityTarget: string;
  deltaVelocity: string;
  onVelocityChange: (velocityTarget: string, deltaVelocity: string) => void;
}

function defaultStartTime(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 16);
}

function defaultEndTime(): string {
  return new Date().toISOString().slice(0, 16);
}

export function FilterPanel({
  filters,
  onFiltersChange,
  onUpdate,
  loading,
  velocityTarget,
  deltaVelocity,
  onVelocityChange,
}: FilterPanelProps) {
  const isLast = filters.periodMode === 'last';
  const isFromDate = filters.periodMode === 'from_date';
  const isAllWorld = filters.regionMode === 'all_world';
  const isRegion = filters.regionMode === 'region';
  const [channelsOpen, setChannelsOpen] = useState(false);

  return (
    <div className="control-panel">
      <div className="control-panel-row">
        <div className="control-group control-group--inline velocity-group">
          <span className="group-title-inline">Velocity</span>
          <label className="velocity-row">
            <span className="velocity-label">V target</span>
            <input
              type="number"
              value={velocityTarget}
              onChange={(e) => onVelocityChange(e.target.value, deltaVelocity)}
            />
            <span className="velocity-unit">km/h</span>
          </label>
          <label className="velocity-row">
            <span className="velocity-label">ΔV</span>
            <input
              type="number"
              value={deltaVelocity}
              onChange={(e) => onVelocityChange(velocityTarget, e.target.value)}
            />
            <span className="velocity-unit">km/h</span>
          </label>
        </div>

        <div className="control-group control-group--inline">
          <span className="group-title-inline">Magnitude</span>
          <input
            type="text"
            placeholder="Min"
            value={filters.minmagnitude}
            onChange={(e) =>
              onFiltersChange({ ...filters, minmagnitude: e.target.value })
            }
          />
          <input
            type="text"
            placeholder="Max"
            value={filters.maxmagnitude}
            onChange={(e) =>
              onFiltersChange({ ...filters, maxmagnitude: e.target.value })
            }
          />
        </div>

      <div className="control-group control-group--inline eq-period">
        <span className="group-title-inline">Eq period</span>
        <label className="radio-label">
          <input
            type="radio"
            name="period"
            checked={isLast}
            onChange={() =>
              onFiltersChange({ ...filters, periodMode: 'last' as PeriodMode })
            }
          />
          Last
        </label>
        <input
          type="number"
          min={1}
          max={365}
          value={filters.lastDays}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              lastDays: Math.max(1, parseInt(e.target.value, 10) || 1),
            })
          }
          className="days-input"
        />
        <span className="days-suffix">days</span>
        <label className="radio-label">
          <input
            type="radio"
            name="period"
            checked={isFromDate}
            onChange={() =>
              onFiltersChange({ ...filters, periodMode: 'from_date' as PeriodMode })
            }
          />
          From date
        </label>
        {isFromDate && (
          <span className="date-range-inline">
            <input
              type="datetime-local"
              value={filters.starttime}
              onChange={(e) =>
                onFiltersChange({ ...filters, starttime: e.target.value })
              }
              aria-label="From date"
            />
            <span className="date-sep">→</span>
            <input
              type="datetime-local"
              value={filters.endtime}
              onChange={(e) =>
                onFiltersChange({ ...filters, endtime: e.target.value })
              }
              aria-label="To date"
            />
          </span>
        )}
      </div>

      <div className="control-group region-group">
        <div className="region-group-row">
          <span className="group-title-inline">Region</span>
          <label className="radio-label">
            <input
              type="radio"
              name="region"
              checked={isAllWorld}
              onChange={() =>
                onFiltersChange({ ...filters, regionMode: 'all_world' as RegionMode })
              }
            />
            All world
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="region"
              checked={isRegion}
              onChange={() =>
                onFiltersChange({ ...filters, regionMode: 'region' as RegionMode })
              }
            />
            Region
          </label>
        </div>
        {isRegion && (
          <div className="region-bbox-cross">
            <div className="bbox-cell bbox-north">
              <label className="bbox-label">North</label>
              <input
                type="text"
                placeholder="lat"
                value={filters.maxlatitude}
                onChange={(e) =>
                  onFiltersChange({ ...filters, maxlatitude: e.target.value })
                }
                aria-label="Max latitude"
              />
            </div>
            <div className="bbox-cell bbox-west">
              <label className="bbox-label">West</label>
              <input
                type="text"
                placeholder="lon"
                value={filters.minlongitude}
                onChange={(e) =>
                  onFiltersChange({ ...filters, minlongitude: e.target.value })
                }
                aria-label="Min longitude"
              />
            </div>
            <div className="bbox-cell bbox-east">
              <label className="bbox-label">East</label>
              <input
                type="text"
                placeholder="lon"
                value={filters.maxlongitude}
                onChange={(e) =>
                  onFiltersChange({ ...filters, maxlongitude: e.target.value })
                }
                aria-label="Max longitude"
              />
            </div>
            <div className="bbox-cell bbox-south">
              <label className="bbox-label">South</label>
              <input
                type="text"
                placeholder="lat"
                value={filters.minlatitude}
                onChange={(e) =>
                  onFiltersChange({ ...filters, minlatitude: e.target.value })
                }
                aria-label="Min latitude"
              />
            </div>
          </div>
        )}
      </div>

      <div className="control-actions">
        <button type="button" className="primary" onClick={onUpdate} disabled={loading}>
          Update
        </button>
        <button
          type="button"
          className="channels-btn"
          onClick={() => setChannelsOpen(true)}
          title="Manage channels"
        >
          Channels
        </button>
        <input
          type="text"
          className="search-input"
          placeholder="Search"
          aria-label="Search"
        />
        <button type="button">Fields</button>
        <button type="button">Purge</button>
        <button type="button">Save</button>
      </div>
      </div>
      <ChannelsDialog open={channelsOpen} onClose={() => setChannelsOpen(false)} />
    </div>
  );
}
