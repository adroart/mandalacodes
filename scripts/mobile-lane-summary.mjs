/**
 * State the mobile Playwright lane's real result on the run summary page.
 *
 * The lane is blocking: a red or incomplete mobile suite makes the
 * `test-mobile` job fail. The ordinary list reporter is readable while the
 * suite runs; this script adds durable counts to the run summary so a reviewer
 * can see what failed or was never reached without reconstructing it from the
 * complete log.
 *
 * This is that surface. It runs on every path, including the one where the
 * suite stopped at its own --global-timeout with most of its tests unreached,
 * and it exits non-zero whenever the lane did not fully pass, preserving the
 * blocking result even when Playwright stopped at its own time budget.
 *
 * It reports the gate's result. It does not compare against a recorded baseline:
 * a count measured on one machine is not the count another machine gets
 * (timing failures can multiply on a slower runner), and a gate that fires on
 * that difference would turn a merge red for a reason nobody could act on.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'

const jsonPath = process.argv[2]
function out(markdown) {
  const summary = process.env.GITHUB_STEP_SUMMARY
  if (summary) appendFileSync(summary, `${markdown}\n`)
  else process.stdout.write(`${markdown}\n`)
}

// Playwright nests a suite per file and, for describe blocks, suites inside
// suites. Only the leaf specs carry results.
function collectSpecs(suites, acc = []) {
  for (const suite of suites ?? []) {
    for (const spec of suite.specs ?? []) acc.push(spec)
    collectSpecs(suite.suites, acc)
  }
  return acc
}

if (!existsSync(jsonPath)) {
  // Playwright never got to write a report at all: the runner killed the job
  // at its cap, or the process died. This is the path that used to produce
  // nothing whatever — no counts, no artifact, no record that the lane had
  // tried (run 35070372247). Saying so out loud is the point.
  out('## Mobile Chrome lane: no result')
  out('')
  out(
    `The suite did not finish, so there are no counts for this run. \`${jsonPath}\` was never written — the run step hit its time budget, or the runner died before Playwright reported.`,
  )
  out('')
  out('The `list` reporter output in the job log above is the only record of how far it got.')
  console.log(`::warning title=Mobile Chrome lane produced no result::${jsonPath} was never written; the suite did not finish`)
  process.exit(1)
}

const report = JSON.parse(readFileSync(jsonPath, 'utf8'))
const specs = collectSpecs(report.suites)

const byFile = new Map()
const counts = { passed: 0, failed: 0, timedOut: 0, skipped: 0, interrupted: 0, notRun: 0 }

for (const spec of specs) {
  for (const test of spec.tests ?? []) {
    // No results at all means the suite's own budget ran out before this test
    // was reached. Counting those as skipped would read as a deliberate skip,
    // and dropping them makes the table not add up to the total.
    const status = test.results?.length ? test.results.at(-1).status : 'notRun'
    counts[status in counts ? status : 'notRun'] += 1
    if (status === 'failed' || status === 'timedOut' || status === 'interrupted') {
      const file = spec.file ?? 'unknown'
      const entry = byFile.get(file) ?? { failed: 0, timedOut: 0, interrupted: 0 }
      entry[status] += 1
      byFile.set(file, entry)
    }
  }
}

const red = counts.failed + counts.timedOut + counts.interrupted
const total = Object.values(counts).reduce((a, b) => a + b, 0)
const ran = total - counts.notRun
const seconds = Math.round((report.stats?.duration ?? 0) / 1000)
const cutShort =
  counts.notRun > 0 || (report.errors ?? []).some((e) => /for the test suite to run/.test(e.message ?? ''))

out(cutShort ? `## Mobile Chrome lane: cut short, ${red} red of the ${ran} that ran` : `## Mobile Chrome lane: ${red} red of ${total}`)
out('')
out('| | tests |')
out('| --- | --- |')
out(`| passed | ${counts.passed} |`)
out(`| failed | ${counts.failed} |`)
out(`| timed out | ${counts.timedOut} |`)
if (counts.interrupted) out(`| interrupted | ${counts.interrupted} |`)
if (counts.skipped) out(`| skipped | ${counts.skipped} |`)
if (counts.notRun) out(`| never reached | ${counts.notRun} |`)
out(`| **total** | **${total}** |`)
out('')
out(`Ran in ${Math.floor(seconds / 60)}m ${seconds % 60}s.`)
out('')

if (cutShort) {
  out(
    `**These counts are partial.** The suite hit its own \`--global-timeout\` before reaching ${counts.notRun} of its ${total} tests, so the red count below is a floor, not the total. Raising that budget is not the fix; the suite taking this long is.`,
  )
  out('')
}

if (red === 0 && !cutShort) {
  out('Nothing red. The blocking mobile lane passed.')
  console.log('::notice title=Mobile Chrome lane is green::no failures')
  process.exit(0)
}

if (red === 0) {
  out('Nothing red in what ran.')
  console.log(`::warning title=Mobile Chrome lane was cut short::${counts.notRun} of ${total} tests were never reached`)
  process.exit(1)
}

out('### Where the red is')
out('')
out('| spec file | failed | timed out |')
out('| --- | --- | --- |')
for (const [file, entry] of [...byFile].sort((a, b) => {
  const n = (e) => e.failed + e.timedOut + e.interrupted
  return n(b[1]) - n(a[1])
})) {
  out(`| \`${file}\` | ${entry.failed} | ${entry.timedOut + entry.interrupted} |`)
}
out('')
out(
  `This blocking CI job failed. Resolve the ${red} red result${red === 1 ? '' : 's'} above, or establish that a reported failure is an invalid test contract, before publishing.`,
)

console.log(
  `::warning title=Mobile Chrome lane is red::${red} of the ${ran} tests that ran are red (${counts.failed} failed, ${counts.timedOut} timed out). This blocking job fails; see the run summary.`,
)
process.exit(1)
