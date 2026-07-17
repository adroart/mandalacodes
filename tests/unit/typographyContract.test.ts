import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const THEME_FILE = join(ROOT, 'src/theme.css');
const GLOBAL_STYLES_FILE = join(ROOT, 'content-site/src/styles/global.css');
const SITE_BAR_FILE = join(ROOT, 'content-site/src/styles/site-bar.css');
const APP_ENTRY_FILE = join(ROOT, 'index.tsx');
const IOWAN_WEB_FONTS = [
  'iowan-old-style-latin-400-normal.woff2',
  'iowan-old-style-latin-400-italic.woff2',
  'iowan-old-style-latin-700-normal.woff2',
  'iowan-old-style-latin-700-italic.woff2',
];

const SOURCE_ROOTS = ['src', 'components', 'content-site/src', 'shared'];
const ROOT_EXCLUDED_FILE_PREFIXES = [
  'vite.config.', 'tailwind.config.', 'postcss.config.', 'playwright.config.', 'vitest.config.', 'eslint.config.',
];
// `_mockups` and `_src` are archived design fixtures; generated source remains
// in scope because it is imported and shipped by the application.
const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'dist', '_mockups', '_src']);
const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.html', '.js', '.jsx', '.ts', '.tsx']);
const CANONICAL_FONT_ROLES = [
  '--font-display',
  '--font-reading',
  '--font-ui',
  '--font-technical',
  '--font-cjk',
  '--font-calligraphic',
  '--font-brand',
];
const APPROVED_FONT_VARIABLES = new Set([
  ...CANONICAL_FONT_ROLES,
  '--serif',
  '--sans',
  '--mono',
  '--cjk',
  '--font-serif',
  '--font-sans',
  '--font-mono',
  '--font-label',
]);
const FONT_RESET_VALUES = new Set(['inherit', 'initial', 'unset', 'revert', 'revert-layer']);
const LEGACY_FONT_UTILITY_PATTERN = /\bfont-(?:serif|sans|mono)\b/g;
const FONT_SHORTHAND_KEYWORDS = new Set([
  'normal', 'italic', 'oblique', 'small-caps', 'all-small-caps', 'petite-caps',
  'all-petite-caps', 'unicase', 'titling-caps', 'bold', 'bolder', 'lighter',
  'ultra-condensed', 'extra-condensed', 'condensed', 'semi-condensed', 'semi-expanded',
  'expanded', 'extra-expanded', 'ultra-expanded',
]);

type FontDeclaration = {
  file: string;
  line: number;
  property: 'font-family' | 'fontFamily' | 'font';
  value: string;
};

type FontVariableDefinition = {
  file: string;
  line: number;
  variable: string;
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
  const rootProductionFiles = readdirSync(ROOT, { withFileTypes: true })
    .filter((entry) => entry.isFile()
      && SOURCE_EXTENSIONS.has(extname(entry.name))
      && !ROOT_EXCLUDED_FILE_PREFIXES.some((prefix) => entry.name.startsWith(prefix)))
    .map((entry) => join(ROOT, entry.name));

  return [
    ...SOURCE_ROOTS.flatMap((sourceRoot) => collectProductionFiles(join(ROOT, sourceRoot))),
    ...rootProductionFiles,
  ];
}

function maskComments(source: string): string {
  let result = '';
  let state: 'code' | 'line-comment' | 'block-comment' | 'single-quote' | 'double-quote' | 'template' = 'code';

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    const nextCharacter = source[index + 1];

    if (state === 'line-comment') {
      result += character === '\n' ? '\n' : ' ';
      if (character === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      result += character === '\n' ? '\n' : ' ';
      if (character === '*' && nextCharacter === '/') {
        result += ' ';
        index += 1;
        state = 'code';
      }
      continue;
    }
    if (state !== 'code') {
      result += character;
      if (character === '\\') {
        result += nextCharacter ?? '';
        index += 1;
      } else if ((state === 'single-quote' && character === "'")
        || (state === 'double-quote' && character === '"')
        || (state === 'template' && character === '`')) {
        state = 'code';
      }
      continue;
    }

    if (character === '/' && nextCharacter === '/') {
      result += '  ';
      index += 1;
      state = 'line-comment';
    } else if (character === '/' && nextCharacter === '*') {
      result += '  ';
      index += 1;
      state = 'block-comment';
    } else {
      result += character;
      if (character === "'") state = 'single-quote';
      if (character === '"') state = 'double-quote';
      if (character === '`') state = 'template';
    }
  }

  return result;
}

function fontDeclarations(file: string): FontDeclaration[] {
  const source = readFileSync(file, 'utf8');
  const searchableSource = maskComments(source);
  const declarations: FontDeclaration[] = [];
  const isCssLikeFile = ['.astro', '.css', '.html'].includes(extname(file));
  const declarationPatterns = [
    {
      property: 'font-family' as const,
      pattern: /font-family\s*:\s*([^;}\n]+)/g,
      value: (match: RegExpMatchArray) => match[1],
    },
    ...(isCssLikeFile ? [{
      property: 'font' as const,
      pattern: /\bfont\s*:\s*([^;}\n]+)/g,
      value: (match: RegExpMatchArray) => match[1],
    }] : []),
  ];

  for (const { property, pattern, value } of declarationPatterns) {
    for (const match of searchableSource.matchAll(pattern)) {
      const offset = match.index ?? 0;
      const declarationValue = value(match).trim();
      declarations.push({
        file: relative(ROOT, file),
        line: searchableSource.slice(0, offset).split('\n').length,
        property,
        value: declarationValue,
      });
    }
  }

  return [...declarations, ...jsxStyleDeclarations(file, source), ...cssInJsFontShorthands(file, source)];
}

function scriptKind(file: string): ts.ScriptKind {
  switch (extname(file)) {
    case '.tsx': return ts.ScriptKind.TSX;
    case '.jsx': return ts.ScriptKind.JSX;
    case '.js': return ts.ScriptKind.JS;
    default: return ts.ScriptKind.TS;
  }
}

function jsxStyleDeclarations(file: string, source: string): FontDeclaration[] {
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(extname(file))) return [];

  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
  const declarations: FontDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(sourceFile) === 'style'
      && node.initializer && ts.isJsxExpression(node.initializer)
      && node.initializer.expression && ts.isObjectLiteralExpression(node.initializer.expression)) {
      for (const property of node.initializer.expression.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const propertyName = property.name.getText(sourceFile);
        if (propertyName !== 'font' && propertyName !== 'fontFamily') continue;
        const position = property.getStart(sourceFile);
        declarations.push({
          file: relative(ROOT, file),
          line: sourceFile.getLineAndCharacterOfPosition(position).line + 1,
          property: propertyName,
          value: property.initializer.getText(sourceFile),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return declarations;
}

function cssInJsFontShorthands(file: string, source: string): FontDeclaration[] {
  if (!['.js', '.jsx', '.ts', '.tsx'].includes(extname(file))) return [];

  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
  const declarations: FontDeclaration[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isTaggedTemplateExpression(node)) {
      const tag = node.tag.getText(sourceFile);
      if (/\b(?:css|keyframes)\b|\bstyled\b/.test(tag)) {
        const template = node.template.getText(sourceFile);
        for (const match of template.matchAll(/\bfont\s*:\s*([^;}\n]+)/g)) {
          const offset = node.template.getStart(sourceFile) + (match.index ?? 0);
          declarations.push({
            file: relative(ROOT, file),
            line: sourceFile.getLineAndCharacterOfPosition(offset).line + 1,
            property: 'font',
            value: match[1].trim(),
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return declarations;
}

function approvedFontVariableDefinitions(file: string): FontVariableDefinition[] {
  const source = maskComments(readFileSync(file, 'utf8'));
  const variableNames = [...APPROVED_FONT_VARIABLES]
    .map((variable) => variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const definitionPattern = new RegExp(`(?:^|[;,{\\s])(${variableNames})\\s*:`, 'g');

  return [...source.matchAll(definitionPattern)].map((match) => ({
    file: relative(ROOT, file),
    line: source.slice(0, match.index ?? 0).split('\n').length,
    variable: match[1],
  }));
}

function formatDiagnostics(declarations: FontDeclaration[]): string {
  return declarations
    .map(({ file, line, property, value }) => `${file}:${line} must use an approved semantic variable for ${property}: ${value}`)
    .join('\n');
}

function normalizedValue(value: string): string {
  const withoutImportant = value.replace(/\s*!important\s*$/, '').trim();
  const quotedValue = withoutImportant.match(/^(['"`])([\s\S]*)\1$/);
  return quotedValue ? quotedValue[2].trim() : withoutImportant;
}

function isApprovedFontVariable(value: string): boolean {
  const match = normalizedValue(value).match(/^var\(\s*(--[\w-]+)\s*\)$/);
  return Boolean(match && APPROVED_FONT_VARIABLES.has(match[1]));
}

function isApprovedFontShorthand(value: string): boolean {
  const normalized = normalizedValue(value);
  if (FONT_RESET_VALUES.has(normalized)) return true;

  const approvedVariablePattern = /var\(\s*(--[\w-]+)\s*\)/g;
  const variables = [...normalized.matchAll(approvedVariablePattern)].map((match) => match[1]);
  if (!variables.some((variable) => APPROVED_FONT_VARIABLES.has(variable))) return false;

  const residual = normalized
    .replace(approvedVariablePattern, '')
    .replace(/(?:calc|clamp|min|max)\([^)]*\)/g, '')
    .replace(/[-+]?\d*\.?\d+(?:%|[a-z]+)?/gi, '')
    .replace(/[\s/,]+/g, ' ')
    .trim();
  const words = residual.match(/[a-z][\w-]*/gi) ?? [];

  return words.every((word) => FONT_SHORTHAND_KEYWORDS.has(word.toLowerCase()));
}

function isSemanticFontDeclaration({ property, value }: FontDeclaration): boolean {
  return property === 'font' ? isApprovedFontShorthand(value) : isApprovedFontVariable(value);
}

describe('centralized typography contract', () => {
  it('self-hosts Iowan Old Style for every non-display text role', () => {
    const theme = maskComments(readFileSync(THEME_FILE, 'utf8'));
    const appEntry = readFileSync(APP_ENTRY_FILE, 'utf8');

    expect(theme).toMatch(/^\s*--font-reading:\s*"Iowan Old Style Web"/m);
    expect(theme).toMatch(/^\s*--font-ui:\s*"Iowan Old Style Web"/m);
    expect(theme).toMatch(/font-family:\s*"Iowan Old Style Web"/);
    expect(appEntry).not.toMatch(/@fontsource\/(?:lora|karla)/);

    const missingAssets = IOWAN_WEB_FONTS.filter(
      (file) => !existsSync(join(ROOT, 'public/fonts', file)),
    );
    expect(missingAssets, `Add the licensed Iowan web assets: ${missingAssets.join(', ')}`).toEqual([]);
  });

  it('defines every canonical semantic font role as a declaration in src/theme.css', () => {
    const theme = maskComments(readFileSync(THEME_FILE, 'utf8'));
    const missingRoles = CANONICAL_FONT_ROLES.filter(
      (role) => !new RegExp(`^\\s*${role}\\s*:`, 'm').test(theme),
    );

    expect(missingRoles, `Add missing canonical font roles to src/theme.css: ${missingRoles.join(', ')}`).toEqual([]);
  });

  it('routes every production font declaration through an approved semantic variable outside src/theme.css', () => {
    const violations = activeProductionFiles()
      .filter((file) => file !== THEME_FILE)
      .flatMap(fontDeclarations)
      .filter((declaration) => !isSemanticFontDeclaration(declaration));

    expect(
      violations,
      `Replace direct font declarations with approved semantic variables:\n${formatDiagnostics(violations)}`,
    ).toEqual([]);
  });

  it('does not redefine approved font variables outside src/theme.css', () => {
    const violations = activeProductionFiles()
      .filter((file) => file !== THEME_FILE)
      .flatMap(approvedFontVariableDefinitions);

    expect(
      violations,
      `Keep approved font variables owned by src/theme.css:\n${violations
        .map(({ file, line, variable }) => `${file}:${line} redefines ${variable}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('does not use ambiguous legacy font utilities in production source', () => {
    const violations = activeProductionFiles()
      .filter((file) => file !== THEME_FILE)
      .flatMap((file) => {
        const source = maskComments(readFileSync(file, 'utf8'));
        return [...source.matchAll(LEGACY_FONT_UTILITY_PATTERN)].map((match) => ({
          file: relative(ROOT, file),
          line: source.slice(0, match.index ?? 0).split('\n').length,
          utility: match[0],
        }));
      });

    expect(
      violations,
      `Replace legacy utilities with font-display, font-reading, font-ui, or font-technical:\n${violations
        .map(({ file, line, utility }) => `${file}:${line} uses ${utility}`)
        .join('\n')}`,
    ).toEqual([]);
  });

  it('imports the shared theme into the content-site bar stylesheet', () => {
    const siteBar = readFileSync(SITE_BAR_FILE, 'utf8');

    expect(siteBar).toContain("@import '../../../src/theme.css';");
  });

  it('uses approved semantic font variables for every global content-site font declaration', () => {
    const violations = fontDeclarations(GLOBAL_STYLES_FILE).filter(
      (declaration) => !isSemanticFontDeclaration(declaration),
    );

    expect(
      violations,
      `Use approved semantic font variables in content-site/src/styles/global.css:\n${formatDiagnostics(violations)}`,
    ).toEqual([]);
  });
});
