import React from 'react';
import { SIZE_BAND_LABELS, SIZE_BANDS } from '../../utils/sizeBands';
import type { SizeBand } from '../../utils/sizeBands';

export type AtlasStatusFilter = 'all' | 'placed' | 'seeking';

export interface AtlasFiltersProps {
  series: readonly string[];        // available series for the dropdown
  selectedSeries: string;            // 'all' or a specific series name
  onSeriesChange: (next: string) => void;
  /** Kind facets present in the current data (e.g. 'sixty-four', 'mandala',
   *  'signature', category slugs). The KIND row shows only when more than one
   *  kind exists, so today's UL-only world shows no new chrome. */
  kinds: readonly string[];
  /** 'all' or a specific kind. */
  selectedKind: string;
  onKindChange: (next: string) => void;
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
  /** Visual seating. 'paper' (default): the light-chrome segmented form used
      beside the fallback globe. 'stage': the quiet dark-globe overlay, text
      toggles with a bronze underline, no filled chips or web-form boxes. */
  variant?: 'paper' | 'stage';
}

const STATUS_OPTIONS: ReadonlyArray<{ value: AtlasStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'placed', label: 'Placed' },
  { value: 'seeking', label: 'Seeking ground' },
];

// ─── Kind facet ────────────────────────────────────────────────────────────
// Ratified labels (todo/plans/claim-code-integration.md, gap 7), verbatim.
// The three named kinds lead, in this order; every other kind (a category
// slug) follows, data-driven, humanized from its slug.
const KIND_LABELS: Readonly<Record<string, string>> = {
  'sixty-four': 'the sixty-four',
  mandala: 'mandalas',
  signature: 'signature pieces',
};
const KIND_ORDER: readonly string[] = ['sixty-four', 'mandala', 'signature'];

function kindLabel(kind: string): string {
  return (
    KIND_LABELS[kind] ??
    kind.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Order kinds: the three ratified kinds first (in their fixed order), then
 *  any data-driven others alphabetically. */
function orderedKinds(kinds: readonly string[]): string[] {
  const known = KIND_ORDER.filter((k) => kinds.includes(k));
  const rest = kinds.filter((k) => !KIND_ORDER.includes(k)).sort();
  return [...known, ...rest];
}

// ─── 'paper' variant ─────────────────────────────────────────────────────
const btnBase =
  'font-label text-[11px] uppercase tracking-[0.18em] px-4 min-h-[44px] border transition-colors duration-200 focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2';
const active = 'bg-wood-900 text-paper-50 border-wood-900 z-10 relative';
const inactive =
  'text-wood-700 border-wood-400 hover:text-wood-900 hover:border-wood-700 bg-transparent';

const PaperFilters: React.FC<AtlasFiltersProps> = ({
  series,
  selectedSeries,
  onSeriesChange,
  kinds,
  selectedKind,
  onKindChange,
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
  const kindRow = orderedKinds(kinds);

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
              className="appearance-none bg-transparent border border-wood-400 focus:border-bronze-700 text-wood-900 font-reading text-sm pl-3 pr-10 py-2.5 min-h-[44px] outline-none focus:outline-2 focus:outline-bronze-700 focus:outline-offset-2 transition-colors duration-200"
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

      {/* Kind filter — chip row; shown only when more than one kind exists,
          so today's UL-only world shows no new chrome. */}
      {kindRow.length >= 2 && (
        <div role="group" aria-label="Kind filter" className="flex flex-wrap items-center gap-2">
          <span className="font-label text-[11px] uppercase tracking-[0.18em] text-wood-700 mr-1">
            Kind
          </span>
          <button
            type="button"
            aria-pressed={selectedKind === 'all'}
            onClick={() => onKindChange('all')}
            className={`${btnBase} ${selectedKind === 'all' ? active : inactive}`}
          >
            All
          </button>
          {kindRow.map((kind) => {
            const isActive = selectedKind === kind;
            return (
              <button
                key={kind}
                type="button"
                aria-pressed={isActive}
                onClick={() => onKindChange(kind)}
                className={`${btnBase} ${isActive ? active : inactive}`}
              >
                {kindLabel(kind)}
              </button>
            );
          })}
        </div>
      )}

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

// ─── 'stage' variant ─────────────────────────────────────────────────────
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
              className={`font-display text-[15px] leading-none pb-1 border-b transition-colors duration-200 ${
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

const StageFilters: React.FC<AtlasFiltersProps> = ({
  series,
  selectedSeries,
  onSeriesChange,
  kinds,
  selectedKind,
  onKindChange,
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
  const kindRow = orderedKinds(kinds);
  const kindOptions =
    kindRow.length >= 2
      ? [{ value: 'all', label: 'All' }, ...kindRow.map((k) => ({ value: k, label: kindLabel(k) }))]
      : null;
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
      {kindOptions && (
        <TextToggle label="Kind" options={kindOptions} value={selectedKind} onChange={onKindChange} />
      )}
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

/**
 * Atlas filter controls, merged from two parallel components
 * (AtlasFilters + AtlasFiltersDark) into one with a `variant` prop: the same
 * data-shaped controls, redrawn per surface. 'paper' is the light-chrome form
 * beside the fallback (no-WebGL) globe; 'stage' is the quiet dark overlay on
 * the immersive globe. Each variant's rendered output is unchanged from its
 * former standalone component.
 */
const AtlasFilters: React.FC<AtlasFiltersProps> = ({ variant = 'paper', ...props }) =>
  variant === 'stage' ? <StageFilters {...props} /> : <PaperFilters {...props} />;

export default AtlasFilters;
