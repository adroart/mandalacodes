/**
 * Series → marker hue. Each art series reads as its own constellation. Named
 * series get a hand-picked on-brand color; any unlisted series is assigned a
 * stable distinct bronze-family hue automatically, so new series light up with
 * zero code changes as they're added to the archive.
 *
 * Lives in its own module so the page chrome (legend) can color series labels
 * without pulling the heavy library globe into the main chunk.
 */

const SERIES_COLORS: Record<string, string> = {
  'Universal Language': '#c4aa7c', // bronze — the founding series
  Mandala: '#b98a6e',              // warm terracotta
  'Light Codes': '#d6c38a',        // pale gold
};

// Deterministic fallback hue for any series not named above. Keeps everything
// in a warm band (gold→amber→rose) so the map stays cohesive, never garish.
function autoSeriesColor(series: string): string {
  let h = 0;
  for (let i = 0; i < series.length; i++) h = (h * 31 + series.charCodeAt(i)) % 360;
  const hue = 28 + (h % 40); // 28..68° — amber/gold/bronze band only
  return `hsl(${hue}, 46%, 62%)`;
}

export function seriesColor(series?: string): string {
  if (!series) return SERIES_COLORS['Universal Language'];
  return SERIES_COLORS[series] ?? autoSeriesColor(series);
}
