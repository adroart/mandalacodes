import assert from 'node:assert/strict';
import { onRequestPost as controlPost } from '../functions/api/lw/control/[id]';
import { onRequestGet as pollGet, onRequestPost as pollAckPost } from '../functions/api/lw/poll/[id]';

class FakeKV {
  private values = new Map<string, string>();

  async get<T>(key: string, type?: 'json'): Promise<T | string | null> {
    const value = this.values.get(key);
    if (value == null) return null;
    return type === 'json' ? JSON.parse(value) as T : value;
  }

  async put(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.values.delete(key);
  }
}

const json = async (response: Response) => response.json() as Promise<any>;

async function main() {
  const kv = new FakeKV();
  const env = { LIGHTWEAVER_RELAY: kv };
  const cardId = 'card-1';
  const token = 'owner-token';
  await kv.put(`card:${cardId}:meta`, JSON.stringify({ ownerToken: token, label: 'Lightweaver', pairedAt: Date.now() }));

  const controlResponse = await controlPost({
    params: { id: cardId },
    env,
    request: new Request(`https://example.com/api/lw/control/${cardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-LW-Token': token },
      body: JSON.stringify({ patternId: 'wave' }),
    }),
  });
  assert.equal(controlResponse.status, 200);

  const firstPoll = await json(await pollGet({
    params: { id: cardId },
    env,
    request: new Request(`https://example.com/api/lw/poll/${cardId}`, {
      headers: { 'X-LW-Token': token },
    }),
  }));
  assert.equal(firstPoll.pending.patternId, 'wave');
  assert.equal(typeof firstPoll.pending.commandId, 'string');

  const secondPoll = await json(await pollGet({
    params: { id: cardId },
    env,
    request: new Request(`https://example.com/api/lw/poll/${cardId}`, {
      headers: { 'X-LW-Token': token },
    }),
  }));
  assert.equal(secondPoll.pending.commandId, firstPoll.pending.commandId);
  assert.equal(secondPoll.pending.patternId, 'wave');

  const ackResponse = await pollAckPost({
    params: { id: cardId },
    env,
    request: new Request(`https://example.com/api/lw/poll/${cardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-LW-Token': token },
      body: JSON.stringify({ commandId: firstPoll.pending.commandId }),
    }),
  });
  assert.equal(ackResponse.status, 200);

  const afterAck = await json(await pollGet({
    params: { id: cardId },
    env,
    request: new Request(`https://example.com/api/lw/poll/${cardId}`, {
      headers: { 'X-LW-Token': token },
    }),
  }));
  assert.equal(afterAck.pending, null);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
