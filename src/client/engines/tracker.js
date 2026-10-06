// Tracker modules (.mod, .xm, .s3m, .it and friends), played by libopenmpt
// in an AudioWorklet via chiptune3.

import { ChiptuneJsPlayer } from 'chiptune3';
import { el, bytes } from '../ui-kit.js';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export async function open(file, ui) {
  const data = (await bytes(file)).buffer;
  ui.progress('Loading the module player…');
  const player = new ChiptuneJsPlayer({ repeatCount: 0 });
  await new Promise((resolve) => player.onInitialized(resolve));

  const title = el('div', { class: 'player-title' }, file.name);
  const time = el('span', { class: 'time' }, '0:00');
  const bar = el('input', { type: 'range', min: 0, max: 1, value: 0, step: 1, 'aria-label': 'Position' });
  const play = el('button', { type: 'button', class: 'btn' }, 'Pause');
  const meta = el('div', { class: 'player-meta' });
  let paused = false;
  let started = false;

  player.onMetadata((m) => {
    title.textContent = m.title || file.name;
    bar.max = Math.ceil(m.dur);
    meta.textContent = [m.type_long || m.type, m.tracker, m.dur && fmt(m.dur)].filter(Boolean).join(' · ');
    if (!started) { started = true; ui.done(); }
  });
  player.onProgress((p) => {
    bar.value = p.pos;
    time.textContent = fmt(p.pos) + (player.duration ? ' / ' + fmt(player.duration) : '');
  });
  player.onEnded(() => { paused = true; play.textContent = 'Play'; });
  player.onError(() => ui.output.append(el('p', { class: 'status status-error' }, 'This module could not be played. It may be damaged or an unsupported variant.')));
  play.addEventListener('click', async () => {
    await player.context.resume();
    if (paused && bar.value >= bar.max) player.play(data.slice(0));
    else player.togglePause();
    paused = !paused;
    play.textContent = paused ? 'Play' : 'Pause';
  });
  bar.addEventListener('input', () => player.setPos(Number(bar.value)));

  ui.output.append(el('div', { class: 'player' }, title, meta, el('div', { class: 'player-controls' }, play, bar, time)));
  // Browsers block sound until a click; the drop or file pick counts.
  await player.context.resume().catch(() => {});
  player.play(data.slice(0));
}
