// The phone side of memos for AR Create: one memo id per send, so a retry finishes the same memo instead of starting
// a second. Files go up one at a time as raw bodies; nothing is resized or re-encoded on the phone.
(() => {
  const $ = (id) => document.getElementById(id);
  const form = $('send'), go = $('go'), log = $('log');
  const audioInput = $('audio'), photosInput = $('photos');
  let memoId = null, sentPhotos = new Set();

  const say = (text, bad = false) => { const li = document.createElement('li'); li.textContent = text; if (bad) li.className = 'bad'; log.append(li); };
  const sizeOf = (bytes) => bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const guessAudioType = (file) => file.type || (/\.m4a$/i.test(file.name) ? 'audio/mp4' : /\.mp3$/i.test(file.name) ? 'audio/mpeg' : /\.wav$/i.test(file.name) ? 'audio/wav' : 'audio/mp4');
  const refresh = () => { go.disabled = !audioInput.files.length; };

  async function api(path, init = {}) {
    const response = await fetch(path, { credentials: 'same-origin', ...init });
    if (response.status === 401 || response.status === 403) { $('signin').hidden = false; throw new Error('sign in first'); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  audioInput.addEventListener('change', () => {
    const file = audioInput.files[0];
    $('audioName').textContent = file ? `${file.name} · ${sizeOf(file.size)}` : 'Choose the voice memo';
    if (file && file.size > 25 * 1048576) say('This recording is over 25 MB. Split it in Voice Memos (Trim) and send each part as its own memo.', true);
    memoId = null; refresh();
  });
  photosInput.addEventListener('change', () => {
    const files = [...photosInput.files].slice(0, 20);
    $('photosName').textContent = files.length ? `${files.length} photo${files.length > 1 ? 's' : ''}` : 'Choose photos, up to 20';
    $('thumbs').replaceChildren(...files.map((file) => { const img = new Image(); img.alt = file.name; img.src = URL.createObjectURL(file); return img; }));
    sentPhotos = new Set();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const audio = audioInput.files[0]; if (!audio) return;
    go.disabled = true; log.replaceChildren();
    try {
      memoId = memoId || crypto.randomUUID();
      await api('/api/memos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: memoId, title: $('title').value }) });
      say(`Sending the recording (${sizeOf(audio.size)})…`);
      await api(`/api/memos/${memoId}/audio`, { method: 'POST', headers: { 'Content-Type': guessAudioType(audio) }, body: audio });
      say('Recording sent.');
      const photos = [...photosInput.files].slice(0, 20);
      for (const [index, photo] of photos.entries()) {
        const mark = `${photo.name}:${photo.size}:${photo.lastModified}`; if (sentPhotos.has(mark)) continue;
        say(`Photo ${index + 1} of ${photos.length}…`);
        await api(`/api/memos/${memoId}/photos?name=${encodeURIComponent(photo.name)}`, { method: 'POST', headers: { 'Content-Type': photo.type || 'image/jpeg' }, body: photo });
        sentPhotos.add(mark);
      }
      say(`Sent. Tell Claude in chat it's there; Claude transcribes it and starts the story.`);
      form.reset(); $('thumbs').replaceChildren(); $('audioName').textContent = 'Choose the voice memo'; $('photosName').textContent = 'Choose photos, up to 20';
      memoId = null; sentPhotos = new Set();
      await list();
    } catch (error) {
      say(`Stopped: ${error.message}. Press Send again to finish the same memo.`, true);
      go.disabled = false;
    }
  });

  const STATES = { none: 'waiting for Claude', transcribing: 'transcribing', done: 'transcribed', failed: 'transcription failed; Claude tries again' };
  async function list() {
    let memos;
    try { ({ memos } = await api('/api/memos')); } catch { return; }
    if (!memos.length) return;
    const rows = await Promise.all(memos.slice(0, 10).map(async (memo) => {
      const div = document.createElement('div'); div.className = 'memo';
      const when = new Date(memo.createdAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = `${when} · ${memo.photos.length} photo${memo.photos.length === 1 ? '' : 's'} · `;
      const state = document.createElement('span'); state.className = 'state'; state.textContent = STATES[memo.transcript.status] || memo.transcript.status;
      meta.append(state);
      if (memo.picked.vps) meta.append(' · with Claude');
      const title = document.createElement('div'); title.textContent = memo.title || 'Untitled memo';
      div.append(title, meta);
      if (memo.transcript.status === 'done') {
        const { transcript } = await api(`/api/memos/${memo.id}`).catch(() => ({}));
        if (transcript) { const pre = document.createElement('pre'); pre.textContent = transcript; div.append(pre); }
      }
      return div;
    }));
    $('memos').replaceChildren(...rows);
  }

  list();
  setInterval(() => { if (document.visibilityState === 'visible') list(); }, 20000);
})();
