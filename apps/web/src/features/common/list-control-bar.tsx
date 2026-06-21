"use client";

export type SavedView<T extends string> = { label: string; value: T };

export function ListControlBar<T extends string>({
  count,
  emptyLabel,
  label,
  onClearSelection,
  onExport,
  onExportSelected,
  onSelectVisible,
  onSortChange,
  selectedCount,
  sortOptions,
  sortValue,
}: {
  count: number;
  emptyLabel: string;
  label: string;
  onClearSelection: () => void;
  onExport: () => void;
  onExportSelected: () => void;
  onSelectVisible: () => void;
  onSortChange: (value: T) => void;
  selectedCount: number;
  sortOptions: Array<SavedView<T>>;
  sortValue: T;
}) {
  return (
    <section className="list-control-bar" aria-label={label}>
      <div className="list-control-summary">
        <em>{label}</em>
        <span>{count ? `${count} записей` : emptyLabel}</span>
        {selectedCount ? <strong>{selectedCount} выбрано</strong> : <strong>Рабочий вид</strong>}
      </div>
      <div className="list-control-actions">
        <label className="compact-select">
          <span>Sort</span>
          <select value={sortValue} onChange={(event) => onSortChange(event.target.value as T)}>
            {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button className="ghost-button" disabled={!count} onClick={onSelectVisible} type="button">Выбрать видимые</button>
        <button className="ghost-button" disabled={!selectedCount} onClick={onClearSelection} type="button">Снять выбор</button>
        <button className="ghost-button" disabled={!count} onClick={onExport} type="button">Экспорт CSV</button>
        <button className="primary-button" disabled={!selectedCount} onClick={onExportSelected} type="button">Экспорт выбранных</button>
      </div>
    </section>
  );
}

export function EmptyWorkspaceState({
  action,
  description,
  onAction,
  title,
}: {
  action: string;
  description: string;
  onAction: () => void;
  title: string;
}) {
  return (
    <section className="empty-workspace-state">
      <div>
        <span className="empty-state-icon">⌕</span>
      </div>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button className="primary-button" onClick={onAction} type="button">{action}</button>
    </section>
  );
}
