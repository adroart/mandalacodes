/**
 * Dark filter panel for the immersive Atlas overlay.
 *
 * The paper-styled AtlasFilters (white segmented chips, native select, "ON"
 * box) clashes with the dark globe stage. This is the same controls, redrawn
 * for the dark surface: quiet text toggles with a bronze underline for the
 * active one, a hairline series dropdown, and a slim threads switch — text and
 * color only, no filled chips, on-brand.
 */

import React from 'react';
import { SIZE_BAND_LABELS, SIZE_BANDS } from '../../utils/sizeBands';
import type { SizeBand } from '../../utils/sizeBands';
import type { AtlasStatusFilter, AtlasFiltersProps } from './AtlasFilters';

const STATUS_OPTIONS: ReadonlyArray<{ value: AtlasStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'seeking', label: 'Seeking ground' },
];

// A row of quiet text options; the active one carries a bronze underline.
function TextToggle<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-baseline gap-4">
      <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 w-16 shrink-0">
        {label}
      </span>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(o.value)}
              className={`font-reading text-[15px] leading-none pb-1 border-b transition-colors duration-200 ${
                active
                  ? 'text-bronze-300 border-bronze-400/70'
                  : 'text-wood-400 border-transparent hover:text-bronze-300/80'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const AtlasFiltersDark: React.FC<AtlasFiltersProps> = ({
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

  const seriesOptions = [
    { value: 'all', label: 'All series' },
    ...series.map((s) => ({ value: s, label: s })),
  ];
  const categoryOptions =
    categories.length >= 2
      ? [{ value: 'all', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]
      : null;
  const sizeOptions =
    availableSizes.length >= 2
      ? [
          { value: 'all' as SizeBand | 'all', label: 'All' },
          ...SIZE_BANDS.filter((b) => availableSizes.includes(b)).map((b) => ({
            value: b as SizeBand | 'all',
            label: SIZE_BAND_LABELS[b],
          })),
        ]
      : null;

  return (
    <div className="flex flex-col gap-5">
      <TextToggle label="Series" options={seriesOptions} value={selectedSeries} onChange={onSeriesChange} />
      <TextToggle label="Show" options={STATUS_OPTIONS} value={status} onChange={onStatusChange} />
      {categoryOptions && (
        <TextToggle
          label="Type"
          options={categoryOptions}
          value={selectedCategory}
          onChange={onCategoryChange}
        />
      )}
      {sizeOptions && (
        <TextToggle label="Size" options={sizeOptions} value={selectedSize} onChange={onSizeChange} />
      )}

      {/* Threads — a slim switch, the one expressive control. */}
      <div className="flex items-center gap-4 pt-1">
        <span className="font-label text-[10px] uppercase tracking-[0.2em] text-wood-500 w-16 shrink-0">
          Threads
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={kinshipVisible}
          onClick={() => onKinshipChange(!kinshipVisible)}
          className="relative inline-flex h-[18px] w-9 items-center rounded-full border border-bronze-400/30 transition-colors duration-300"
          style={{
            backgroundColor: kinshipVisible ? 'rgba(196,170,124,0.35)' : 'rgba(120,108,90,0.15)',
          }}
        >
          <span
            className="inline-block h-3 w-3 rounded-full transition-transform duration-300"
            style={{
              transform: kinshipVisible ? 'translateX(20px)' : 'translateX(3px)',
              backgroundColor: kinshipVisible ? '#d6c38a' : '#8c7a5c',
            }}
          />
        </button>
        {typeof threadsShown === 'number' && typeof threadsTotal === 'number' && (
          <span className="font-label text-[10px] uppercase tracking-[0.16em] text-wood-500">
            {threadsShown === threadsTotal
              ? `${threadsShown} ${threadsShown === 1 ? 'thread' : 'threads'}`
              : `showing ${threadsShown} of ${threadsTotal} threads`}
          </span>
        )}
      </div>

      <p className="font-label text-[10px] uppercase tracking-[0.18em] text-wood-500 pt-1" aria-live="polite">
        {total} {total === 1 ? 'piece' : 'pieces'}
        <span className="mx-1.5">·</span>
        {placedCount} placed
        <span className="mx-1.5">·</span>
        {seekingCount} seeking ground
      </p>
    </div>
  );
};

export default AtlasFiltersDark;
