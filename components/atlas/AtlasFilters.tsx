import React from 'react';
import { SIZE_BAND_LABELS, SIZE_BANDS } from '../../utils/sizeBands';
import type { SizeBand } from '../../utils/sizeBands';

export type AtlasStatusFilter = 'all' | 'placed' | 'seeking';

export interface AtlasFiltersProps {
  series: readonly string[];        // available series for the dropdown
  selectedSeries: string;            // 'all' or a specific series name
  onSeriesChange: (next: string) => void;
  status: AtlasStatusFilter;
  onStatusChange: (next: AtlasStatusFilter) => void;
  /** Available categories derived from the current data. */
  categories: readonly string[];
  /** 'all' or a specific category name. */
  selectedCategory: string;
  onCategoryChange: (next: string) => void;
  /** Size bands that are represented in the current data. */
  availableSizes: readonly SizeBand[];
  /** 'all' or a specific band. */
  selectedSize: SizeBand | 'all';
  onSizeChange: (next: SizeBand | 'all') => void;
  placedCount: number;
  seekingCount: number;
  /** Kinship arcs visible. Only meaningful when at least one UL piece is placed. */
  kinshipVisible: boolean;
  onKinshipChange: (next: boolean) => void;
  /** Kinship arcs currently rendered (after any cap). */
  threadsShown?: number;
  /** Total kinship pairs before the cap. */
  threadsTotal?: number;
}

const btnBase =
  'font-label text-[11px] uppercase tracking-[0.18em] px-4 min-h-[44px] border transition-colors duration-200 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2';
const active = 'bg-wood-900 text-paper-50 border-wood-900 z-10 relative';
const inactive =
  'text-wood-700 border-wood-400 hover:text-wood-900 hover:border-wood-700 bg-transparent';

const STATUS_OPTIONS: ReadonlyArray<{ value: AtlasStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'seeking', label: 'Seeking ground' },
];

const AtlasFilters: React.FC<AtlasFiltersProps> = ({
  series,
  selectedSeries,
  onSeriesChange,
  status,
  onStatusChange,
  categories,
  selectedCategory,
  onCategoryChange,
  availableSizes,
  selectedSize,
  onSizeChange,
  placedCount,
  seekingCount,
  kinshipVisible,
  onKinshipChange,
  threadsShown,
  threadsTotal,
}) => {
  const total = placedCount + seekingCount;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Series filter — native select keeps it light and accessible. */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="atlas-series"
            className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700"
          >
            Series
          </label>
          <div className="relative">
            <select
              id="atlas-series"
              value={selectedSeries}
              onChange={(e) => onSeriesChange(e.target.value)}
              className="appearance-none bg-transparent border border-wood-400 focus:border-bronze-700 text-wood-900 font-sans text-sm pl-3 pr-10 py-2.5 min-h-[44px] outline-none focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors duration-200"
            >
              <option value="all">All series</option>
              {series.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <span
              aria-hidden
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-label text-[10px] uppercase tracking-[0.18em] text-wood-600"
            >
              ▾
            </span>
          </div>
        </div>

        {/* Status filter — segmented buttons matching site convention. */}
        <div className="flex flex-col gap-2 sm:items-end">
          <div role="group" aria-label="Status filter" className="flex items-center">
            {STATUS_OPTIONS.map((opt, i) => {
              const isActive = status === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => onStatusChange(opt.value)}
                  className={`${btnBase} ${i > 0 ? '-ml-px' : ''} ${
                    isActive ? active : inactive
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p
            className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-600"
            aria-live="polite"
          >
            {total} {total === 1 ? 'piece' : 'pieces'} · {placedCount} placed ·{' '}
            {seekingCount} seeking ground
          </p>
        </div>
      </div>

      {/* Category filter — chip row; hidden when fewer than 2 categories. */}
      {categories.length >= 2 && (
        <div role="group" aria-label="Category filter" className="flex flex-wrap items-center gap-2">
          <span className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 mr-1">
            Category
          </span>
          <button
            type="button"
            aria-pressed={selectedCategory === 'all'}
            onClick={() => onCategoryChange('all')}
            className={`${btnBase} ${selectedCategory === 'all' ? active : inactive}`}
          >
            All
          </button>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isActive}
                onClick={() => onCategoryChange(cat)}
                className={`${btnBase} ${isActive ? active : inactive}`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      )}

      {/* Size filter — chip row; hidden when fewer than 2 sizes present. */}
      {availableSizes.length >= 2 && (
        <div role="group" aria-label="Size filter" className="flex flex-wrap items-center gap-2">
          <span className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 mr-1">
            Size
          </span>
          <button
            type="button"
            aria-pressed={selectedSize === 'all'}
            onClick={() => onSizeChange('all')}
            className={`${btnBase} ${selectedSize === 'all' ? active : inactive}`}
          >
            All
          </button>
          {SIZE_BANDS.filter((band) => availableSizes.includes(band)).map((band) => {
            const isActive = selectedSize === band;
            return (
              <button
                key={band}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSizeChange(band)}
                className={`${btnBase} ${isActive ? active : inactive}`}
              >
                {SIZE_BAND_LABELS[band]}
              </button>
            );
          })}
        </div>
      )}

      {/* Kinship toggle — text-only, paired with a small affordance on the right. */}
      <div className="flex items-center justify-end gap-3">
        <span
          id="atlas-kinship-label"
          className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700"
        >
          Show kinship threads
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={kinshipVisible}
          aria-labelledby="atlas-kinship-label"
          onClick={() => onKinshipChange(!kinshipVisible)}
          className={`${btnBase} ${kinshipVisible ? active : inactive}`}
        >
          {kinshipVisible ? 'On' : 'Off'}
        </button>
      </div>
      {typeof threadsShown === 'number' && typeof threadsTotal === 'number' && (
        <p className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-500 text-right">
          {threadsShown === threadsTotal
            ? `${threadsShown} ${threadsShown === 1 ? 'thread' : 'threads'}`
            : `showing ${threadsShown} of ${threadsTotal} threads`}
        </p>
      )}
    </div>
  );
};

export default AtlasFilters;
