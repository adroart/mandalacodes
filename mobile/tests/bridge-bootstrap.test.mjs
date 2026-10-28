import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const controller = fs.readFileSync(new URL('../ios/App/App/SceneDelegate.swift', import.meta.url), 'utf8');
const script = controller.match(/WKUserScript\(source: """\n([\s\S]*?)\n\s*"""/)[1];

function initialize(cookiesEnabled, httpEnabled) {
  const calls = [];
  const window = { prompt: (...args) => { calls.push(args); return 'native answer'; } };
  vm.runInNewContext(script
    .replaceAll('\\(cookiesEnabled)', String(cookiesEnabled))
    .replaceAll('\\(httpEnabled)', String(httpEnabled)), { window });
  return { window, calls };
}

test('disabled startup probes return immediately without a native prompt', () => {
  const { window, calls } = initialize(false, false);
  assert.equal(window.prompt('{"type":"CapacitorCookies.isEnabled"}'), 'false');
  assert.equal(window.prompt('{"type":"CapacitorHttp"}'), 'false');
  assert.deepEqual(calls, []);
});

test('ordinary prompts and cookie operations preserve native behavior', () => {
  const { window, calls } = initialize(false, false);
  for (const prompt of ['Reading name', '{"type":"CapacitorCookies.get"}', '{"type":"CapacitorCookies.set"}', '{"type":"Other"}', 'not JSON']) {
    assert.equal(window.prompt(prompt, 'default'), 'native answer');
    assert.deepEqual(calls.at(-1), [prompt, 'default']);
  }
});

test('enabled plugin probes retain native configuration handling', () => {
  const { window, calls } = initialize(true, true);
  for (const type of ['CapacitorCookies.isEnabled', 'CapacitorHttp']) {
    assert.equal(window.prompt(JSON.stringify({ type })), 'native answer');
  }
  assert.equal(calls.length, 2);
});
