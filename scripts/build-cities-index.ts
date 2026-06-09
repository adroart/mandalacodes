/**
 * Build a population-sorted cities index for the profile form's place
 * typeahead.
 *
 * The repo ships the generated index at public/data/cities-index.json. It is
 * built from the GeoNames cities15000 dataset (~25k cities, every real town
 * worldwide) plus two GeoNames lookup files so countries and regions render
 * with readable names instead of raw codes.
 *
 * To regenerate / expand:
 *
 *   1. Download three files from https://download.geonames.org/export/dump/ :
 *        - cities15000.zip   (unzip → cities15000.txt; lower popFloor for more)
 *        - countryInfo.txt   (CC → country name)
 *        - admin1CodesASCII.txt (CC.adminCode → region name)
 *   2. Run:
 *        npx tsx scripts/build-cities-index.ts cities15000.txt countryInfo.txt admin1CodesASCII.txt [popFloor]
 *      (popFloor defaults to 15000 — lower it for smaller towns, larger file)
 *
 * Output overwrites public/data/cities-index.json with all cities of
 * population >= popFloor, sorted by population descending so the typeahead
 * naturally prefers larger cities.
 *
 * GeoNames data is CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/).
 * Include "Place data from GeoNames" in site credits.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

interface City {
  name: string;
  admin?: string;
  country: string;
  cc: string;
  lat: number;
  lng: number;
  tz: string;
}

/** Parse countryInfo.txt → { CC: "Country Name" }. */
function loadCountryNames(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const f = line.split('\t');
    // Columns: 0=ISO, 4=Country name
    if (f[0] && f[4]) out[f[0]] = f[4];
  }
  return out;
}

/** Parse admin1CodesASCII.txt → { "CC.adminCode": "Region Name" }. */
function loadAdminNames(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line) continue;
    const f = line.split('\t');
    // Columns: 0=CC.admin1, 1=name, 2=asciiName
    if (f[0] && (f[1] || f[2])) out[f[0]] = f[1] || f[2];
  }
  return out;
}

function main() {
  const [, , tsvPath, countryPath, adminPath, popFloorArg] = process.argv;
  if (!tsvPath || !countryPath || !adminPath) {
    console.error(
      'Usage: tsx scripts/build-cities-index.ts <cities15000.txt> <countryInfo.txt> <admin1CodesASCII.txt> [popFloor=15000]',
    );
    process.exit(1);
  }
  const popFloor = Number(popFloorArg ?? 15_000);

  const countryNames = loadCountryNames(countryPath);
  const adminNames = loadAdminNames(adminPath);

  const tsv = readFileSync(tsvPath, 'utf8');
  const rows = tsv.split('\n');

  type Row = City & { pop: number };
  const out: Row[] = [];
  for (const line of rows) {
    if (!line) continue;
    const f = line.split('\t');
    // GeoNames columns: 1=name, 4=lat, 5=lng, 8=country code,
    //                   10=admin1 code, 14=population, 17=timezone
    const name = f[1];
    const lat = Number(f[4]);
    const lng = Number(f[5]);
    const cc = f[8];
    const adminCode = f[10];
    const pop = Number(f[14] || 0);
    const tz = f[17];
    if (!name || !cc || !tz || Number.isNaN(lat) || Number.isNaN(lng)) continue;
    if (pop < popFloor) continue;
    const country = countryNames[cc] ?? cc;
    const admin = adminCode ? adminNames[`${cc}.${adminCode}`] : undefined;
    out.push({
      name,
      admin: admin || undefined,
      country,
      cc,
      // Round coordinates to 4 decimals (~11m) — plenty for a city-level
      // chart and it trims the file noticeably.
      lat: Math.round(lat * 1e4) / 1e4,
      lng: Math.round(lng * 1e4) / 1e4,
      tz,
      pop,
    });
  }
  out.sort((a, b) => b.pop - a.pop);

  // Strip `pop` from the persisted shape — it's only used here for ordering.
  const persisted = out.map(({ pop, ...rest }) => rest);
  const dest = resolve(scriptDir, '../public/data/cities-index.json');
  writeFileSync(dest, JSON.stringify(persisted));
  console.log(`Wrote ${persisted.length} cities to ${dest}`);
}

main();
