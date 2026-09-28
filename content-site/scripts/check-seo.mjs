import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Run after the content build, or pass the final copied /learn output directory.
const directory = resolve(process.argv[2] || fileURLToPath(new URL('../dist', import.meta.url)))
const read = path => readFileSync(join(directory, path), 'utf8')
const decode = text => text.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
function files(folder = '') {
  return readdirSync(join(directory, folder), { withFileTypes: true }).flatMap(entry => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? (entry.name === '_astro' ? [] : files(path)) : [path]
  })
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [key, decode(value)]))
}

const allFiles = files()
const sitemap = allFiles.filter(file => /^sitemap-\d+\.xml$/.test(file)).map(read).join('\n')
const locations = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, url]) => decode(url)))
const rss = read('rss.xml')
const feedLinks = new Set([...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, item]) => decode(item.match(/<link>(.*?)<\/link>/)[1])))
const llms = read('llms.txt')
let articles = 0
let notes = 0
let pages = 0

for (const file of allFiles.filter(file => file.endsWith('.html'))) {
  const html = read(file)
  assert(!/keystatic|_template/i.test(file), `Private page emitted: ${file}`)
  const metadata = [...html.matchAll(/<meta\b[^>]*>/g)].map(match => attributes(match[0]))
  const meta = name => metadata.find(value => value.name === name || value.property === name)?.content
  const canonicals = [...html.matchAll(/<link\b[^>]*>/g)].map(match => attributes(match[0])).filter(link => link.rel === 'canonical')
  assert.equal(canonicals.length, 1, `${file}: expected one canonical`)
  const canonical = canonicals[0].href
  const expectedPath = '/learn/' + file.replace(/index\.html$/, '').replace(/\\/g, '/')
  assert.equal(canonical, `https://mandalacodes.com${expectedPath}`, `${file}: wrong canonical`)
  assert.equal(meta('og:url'), canonical, `${file}: OG URL differs from canonical`)
  assert.equal((html.match(/<main\b/g) || []).length, 1, `${file}: expected one main landmark`)
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: expected one main heading`)
  assert.match(meta('og:image') || '', /^https:\/\//, `${file}: image must be absolute`)
  assert.equal(meta('og:image'), meta('twitter:image'), `${file}: social images differ`)
  const noindex = /\bnoindex\b/.test(meta('robots') || '')
  assert.equal(locations.has(canonical), !noindex, `${file}: sitemap disagrees with robots`)
  const blocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json))
  const article = blocks.find(block => block['@type'] === 'Article')
  if (article) {
    articles++
    if (noindex) notes++
    assert.equal(article.mainEntityOfPage, canonical, `${file}: Article canonical differs`)
    assert.equal(article.image, meta('og:image'), `${file}: Article image differs`)
    assert.equal(feedLinks.has(canonical), !noindex, `${file}: RSS disagrees with robots`)
    assert.equal(llms.includes(`](${canonical})`), !noindex, `${file}: llms index disagrees with robots`)
    if (article.author) assert(article.author.name?.trim(), `${file}: author name missing`)
  }
  pages++
}
assert(articles > 0, 'No article pages found; check the output directory')
assert.equal(feedLinks.size, articles - notes, 'Unexpected RSS article count')
assert.equal(locations.size, pages - allFiles.filter(file => file.endsWith('.html')).filter(file => /content="noindex, follow"/.test(read(file))).length, 'Unexpected sitemap URL count')
console.log(`SEO verified: ${pages} pages, ${articles - notes} indexable articles, ${notes} accessible research notes; canonical, image, robots, sitemap and feed checks passed.`)
