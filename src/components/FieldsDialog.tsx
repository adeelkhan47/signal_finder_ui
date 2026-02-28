import { FIELDS_COLUMN_CONFIG } from './EarthquakeTable';
import type { VisibleColumns } from './EarthquakeTable';

interface FieldsDialogProps {
  open: boolean;
  onClose: () => void;
  visibleColumns: VisibleColumns;
  onVisibleColumnsChange: (visible: VisibleColumns) => void;
}

export function FieldsDialog({
  open,
  onClose,
  visibleColumns,
  onVisibleColumnsChange,
}: FieldsDialogProps) {
  if (!open) return null;

  const handleToggle = (key: string) => {
    onVisibleColumnsChange({
      ...visibleColumns,
      [key]: !(visibleColumns[key] !== false),
    });
  };

  return (
    <div
      className="dialog-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fields-dialog-title"
    >
      <div className="dialog fields-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 id="fields-dialog-title" className="dialog-title">
            Fields
          </h2>
          <button type="button" className="dialog-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="dialog-body fields-dialog-body">
          <p className="fields-dialog-hint">Show or hide columns in the earthquake table.</p>
          <ul className="fields-list">
            {FIELDS_COLUMN_CONFIG.map(({ key, label }) => (
              <li key={key} className="fields-list-item">
                <label className="fields-check-label">
                  <input
                    type="checkbox"
                    checked={visibleColumns[key] !== false}
                    onChange={() => handleToggle(key)}
                  />
                  <span>{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <div className="dialog-footer">
          <button type="button" className="dialog-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
