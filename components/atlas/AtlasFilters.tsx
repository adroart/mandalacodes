import React from 'react';

export type AtlasStatusFilter = 'all' | 'placed' | 'seeking';

export interface AtlasFiltersProps {
  series: readonly string[];
  selectedSeries: string;
  onSeriesChange: (next: string) => void;
  status: AtlasStatusFilter;
  onStatusChange: (next: AtlasStatusFilter) => void;
  placedCount: number;
  seekingCount: number;
  threadsShown?: number;
  threadsTotal?: number;
  variant?: 'paper' | 'stage';
}

const STATUS_OPTIONS: ReadonlyArray<{ value: AtlasStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'seeking', label: 'Seeking ground' },
];
const SEEKING_HELP = 'Seeking ground means a piece has no public place on the map yet.';

const AtlasFilters: React.FC<AtlasFiltersProps> = ({
  series, selectedSeries, onSeriesChange, status, onStatusChange,
  placedCount, seekingCount, threadsShown, threadsTotal, variant = 'paper',
}) => {
  const dark = variant === 'stage';
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={dark ? 'atlas-series-stage' : 'atlas-series-paper'} className={`font-label text-[11px] uppercase tracking-[0.18em] ${dark ? 'text-[#d6c38a]' : 'text-ink-soft'}`}>
          Series
        </label>
        <select
          id={dark ? 'atlas-series-stage' : 'atlas-series-paper'}
          value={selectedSeries}
          onChange={(e) => onSeriesChange(e.target.value)}
          className={`min-h-[44px] max-w-full border px-3 py-2 font-reading text-sm focus:outline-2 focus:outline-bronze-700 ${dark ? 'bg-[#211b15] border-bronze-400/40 text-[#f0e8d8]' : 'bg-transparent border-wood-400 text-ink'}`}
        >
          <option value="all">All series</option>
          {series.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div role="group" aria-label="Status filter" className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={status === option.value}
            onClick={() => onStatusChange(option.value)}
            className={`min-h-[44px] px-3 border font-label text-[11px] uppercase tracking-[0.12em] transition-colors focus:outline-2 focus:outline-bronze-700 ${status === option.value ? dark ? 'border-bronze-300 text-[#f0e8d8]' : 'border-wood-900 bg-wood-900 text-ink-inverse' : dark ? 'border-bronze-400/50 text-[#d6c38a] hover:text-[#f0e8d8]' : 'border-wood-400 text-ink-soft hover:border-wood-900'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {status === 'seeking' && seekingCount > 0 && (
        <p className={`font-reading text-sm leading-snug ${dark ? 'text-[#d6c38a]' : 'text-ink-soft'}`}>{SEEKING_HELP}</p>
      )}
      {(threadsTotal ?? 0) > 0 && (
        <p className={`font-reading text-[13px] leading-snug ${dark ? 'text-[#d6c38a]' : 'text-ink-soft'}`}>
          Lines connect placed pieces whose codes share a three-line symbol.
          {' '}Showing {threadsShown ?? 0} of {threadsTotal} connections.
        </p>
      )}
      <p className={`font-label text-[10px] uppercase tracking-[0.16em] ${dark ? 'text-[#d6c38a]' : 'text-ink-muted'}`} aria-live="polite">
        {placedCount + seekingCount} pieces · {placedCount} placed · {seekingCount} seeking ground
      </p>
    </div>
  );
};

export default AtlasFilters;
