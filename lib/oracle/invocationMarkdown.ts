import type { InvocationBlock, SafeBlock, SafeInline } from './invocationTypes';

export class InvocationValidationError extends Error {
  constructor(message: string, public readonly line: number) { super(`Line ${line}: ${message}`); this.name = 'InvocationValidationError'; }
}

const safeUrl = (raw: string, line: number) => {
  let url: URL;
  try { url = new URL(raw); } catch { throw new InvocationValidationError('link URL is invalid', line); }
  if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw new InvocationValidationError('link protocol is not allowed', line);
  return raw;
};

function parseInline(input: string, line: number): SafeInline[] {
  if (input.includes('![')) throw new InvocationValidationError('images are not supported', line);
  const output: SafeInline[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let cursor = 0;
  for (const match of input.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) output.push({ type: 'text', value: input.slice(cursor, index) });
    if (match[2] !== undefined) output.push({ type: 'link', href: safeUrl(match[3], line), children: [{ type: 'text', value: match[2] }] });
    else if (match[4] !== undefined) output.push({ type: 'strong', children: [{ type: 'text', value: match[4] }] });
    else output.push({ type: 'emphasis', children: [{ type: 'text', value: match[5] }] });
    cursor = index + match[0].length;
  }
  if (cursor < input.length) output.push({ type: 'text', value: input.slice(cursor) });
  return output;
}

export function parseInvocationMarkdown(markdown: string): { normalized: string; blocks: SafeBlock[] } {
  const normalized = markdown.replace(/\r\n?/g, '\n').trim();
  if (normalized.length > 100_000) throw new InvocationValidationError('invocation exceeds 100000 characters', 1);
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(normalized)) throw new InvocationValidationError('control characters are not allowed', 1);
  const lines = normalized.split('\n');
  const blocks: SafeBlock[] = [];
  let paragraph: string[] = [];
  let paragraphStart = 1;
  const flush = () => {
    if (!paragraph.length) return;
    const children: SafeInline[] = [];
    paragraph.forEach((line, index) => {
      if (index) children.push({ type: 'text', value: '\n' });
      children.push(...parseInline(line, paragraphStart + index));
    });
    blocks.push({ type: 'paragraph', children }); paragraph = [];
  };
  lines.forEach((line, index) => {
    const number = index + 1;
    if (line === '') { flush(); return; }
    if (/^---\s*$/.test(line)) throw new InvocationValidationError('YAML delimiters are not allowed', number);
    if (/<[^>]*>/.test(line)) throw new InvocationValidationError('raw HTML is not allowed', number);
    if (/^(#\s|[-+*]\s|\d+\.\s|>\s|```|~~~)/.test(line)) throw new InvocationValidationError('unsupported block syntax', number);
    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading) { flush(); blocks.push({ type: 'heading', level: heading[1].length as 2 | 3, children: parseInline(heading[2], number) }); return; }
    if (!paragraph.length) paragraphStart = number;
    paragraph.push(line);
  });
  flush();
  return { normalized, blocks };
}

export function serializeBlocks(blocks: InvocationBlock[]): string {
  const body = [...blocks].sort((a, b) => a.sortOrder - b.sortOrder).map((block) => block.markdown.trim()).filter(Boolean).join('\n\n');
  return parseInvocationMarkdown(body).normalized;
}

const yaml = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n')}"`;
const slug = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'invocation';
const pad2 = (value: number) => String(value).padStart(2, '0');

export function buildInvocationArtifact(input: { hexagramNumber: number; title: string; versionNumber: number; artifactId: string; author: string; createdAt: string; updatedAt: string; body: string }) {
  if (!Number.isInteger(input.hexagramNumber) || input.hexagramNumber < 1 || input.hexagramNumber > 64) throw new InvocationValidationError('hexagram must be from 1 to 64', 1);
  const body = parseInvocationMarkdown(input.body).normalized;
  const prefix = `invocation-${pad2(input.hexagramNumber)}-${slug(input.title)}`;
  const artifactId = input.artifactId.replace(/[^a-zA-Z0-9_-]/g, '-');
  if (!artifactId) throw new InvocationValidationError('artifact identity is required', 1);
  return {
    key: `invocations/${pad2(input.hexagramNumber)}/${prefix}/v${String(input.versionNumber).padStart(6, '0')}-${artifactId}.md`,
    contents: `---\nhexagram: ${input.hexagramNumber}\ntitle: ${yaml(input.title)}\nversion: ${input.versionNumber}\nstatus: live\nauthor: ${yaml(input.author)}\ncreated: ${yaml(input.createdAt)}\nupdated: ${yaml(input.updatedAt)}\n---\n\n${body}\n`,
  };
}
