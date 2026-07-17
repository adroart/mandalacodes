import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const THEME_FILE = join(ROOT, 'src/theme.css');
const GLOBAL_STYLES_FILE = join(ROOT, 'content-site/src/styles/global.css');
const SITE_BAR_FILE = join(ROOT, 'content-site/src/styles/site-bar.css');

const SOURCE_ROOTS = ['src', 'components', 'content-site/src', 'shared'];
const ROOT_FILES = ['index.html', 'index.tsx'];
const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist', 'generated', '_mockups', '_src']);
const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.html', '.js', '.jsx', '.md', '.mdoc', '.ts', '.tsx']);
const CANONICAL_FONT_ROLES = [
  '--font-display',
  '--font-reading',
  '--font-ui',
  '--font-technical',
  '--font-cjk',
  '--font-calligraphic',
  '--font-brand',
];
const TARGET_AND_LEGACY_FAMILIES = [
  'Cormorant Garamond',
  'Lora',
  'Plus Jakarta Sans',
  'IBM Plex Mono',
  'Noto Serif SC',
  'Noto Serif TC',
  'Ma Shan Zheng',
  'Cinzel',
  'Karla',
  'Lato',
  'Source Han Serif SC',
  'Source Han Serif TC',
  'Songti SC',
  'Georgia',
  'Times New Roman',
  'Palatino',
  'Helvetica',
  'Segoe UI',
  'SFMono-Regular',
];

type FontDeclaration = {
  file: string;
  line: number;
  property: 'font-family' | 'fontFamily';
  value: string;
};

function collectProductionFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return EXCLUDED_DIRECTORIES.has(entry.name) ? [] : collectProductionFiles(entryPath);
    }

    return entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name)) ? [entryPath] : [];
  });
}

function activeProductionFiles(): string[] {
  return [
    ...SOURCE_ROOTS.flatMap((sourceRoot) => collectProductionFiles(join(ROOT, sourceRoot))),
    ...ROOT_FILES.map((file) => join(ROOT, file)),
  ];
}

function fontFamilyDeclarations(file: string): FontDeclaration[] {
  const source = readFileSync(file, 'utf8');
  const declarations: FontDeclaration[] = [];
  const declarationPatterns = [
    {
      property: 'font-family' as const,
      pattern: /font-family\s*:\s*([^;}\n]+)/g,
      value: (match: RegExpMatchArray) => match[1],
    },
    {
      property: 'fontFamily' as const,
      pattern: /fontFamily\s*:\s*(?:(['\"`])((?:\\.|(?!\1)[\s\S])*)\1|([^,}\n]+))/g,
      value: (match: RegExpMatchArray) => match[1] ? `${match[1]}${match[2]}${match[1]}` : match[3],
    },
  ];

  for (const { property, pattern, value } of declarationPatterns) {
    for (const match of source.matchAll(pattern)) {
      const offset = match.index ?? 0;
      declarations.push({
        file: relative(ROOT, file),
        line: source.slice(0, offset).split('\n').length,
        property,
        value: value(match).trim(),
      });
    }
  }

  return declarations;
}

function formatDiagnostics(declarations: FontDeclaration[]): string {
  return declarations
    .map(({ file, line, property, value }) => `${file}:${line} hard-codes ${property}: ${value}`)
    .join('\n');
}

describe('centralized typography contract', () => {
  it('defines every canonical semantic font role in src/theme.css', () => {
    const theme = readFileSync(THEME_FILE, 'utf8');
    const missingRoles = CANONICAL_FONT_ROLES.filter(
      (role) => !new RegExp(`^\\s*${role}\\s*:`, 'm').test(theme),
    );

    expect(missingRoles, `Add missing canonical font roles to src/theme.css: ${missingRoles.join(', ')}`).toEqual([]);
  });

  it('uses no direct target or legacy font-family literals outside src/theme.css', () => {
    const literalPattern = new RegExp(
      TARGET_AND_LEGACY_FAMILIES.map((family) => family.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')).join('|'),
      'i',
    );
    const violations = activeProductionFiles()
      .filter((file) => file !== THEME_FILE)
      .flatMap(fontFamilyDeclarations)
      .filter(({ value }) => literalPattern.test(value));

    expect(
      violations,
      `Replace hard-coded families with semantic var(--font-...) roles:\n${formatDiagnostics(violations)}`,
    ).toEqual([]);
  });

  it('imports the shared theme into the content-site bar stylesheet', () => {
    const siteBar = readFileSync(SITE_BAR_FILE, 'utf8');

    expect(siteBar).toContain("@import '../../../src/theme.css';");
  });

  it('uses semantic font roles for every global content-site font-family declaration', () => {
    const violations = fontFamilyDeclarations(GLOBAL_STYLES_FILE).filter(
      ({ value }) => !/var\(--font-[\w-]+\)/.test(value),
    );

    expect(
      violations,
      `Use semantic var(--font-...) roles in content-site/src/styles/global.css:\n${formatDiagnostics(violations)}`,
    ).toEqual([]);
  });
});
