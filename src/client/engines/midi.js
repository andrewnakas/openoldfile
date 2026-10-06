// MIDI files (.mid, .midi, .rmi, .kar), played through SpessaSynth with the
// GeneralUser GS sound bank, and rendered offline to WAV.

import { WorkletSynthesizer, Sequencer, audioBufferToWav } from 'spessasynth_lib';
import { BasicMIDI } from 'spessasynth_core';
import { OpenError, el, bytes } from '../ui-kit.js';

const PROCESSOR = '/vendor/spessasynth/spessasynth_processor.min.js';
const BANK = '/vendor/soundfont/GeneralUserGS.sf3';
let bankPromise = null;
const loadBank = () => (bankPromise ??= fetch(BANK).then((r) => {
  if (!r.ok) throw new OpenError('codec_load', 'The instrument sounds failed to download. Reload the page and try again.');
  return r.arrayBuffer();
}));

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export async function open(file, ui) {
  const data = (await bytes(file)).buffer;
  let midi;
  try {
    midi = BasicMIDI.fromArrayBuffer(data.slice(0), file.name);
  } catch {
    throw new OpenError('decode', 'This is not a readable MIDI file.');
  }
  ui.progress('Loading instrument sounds (8 MB, once)…');
  const bank = await loadBank();

  const ctx = new AudioContext();
  await ctx.audioWorklet.addModule(PROCESSOR);
  const synth = new WorkletSynthesizer(ctx);
  synth.connect(ctx.destination);
  await synth.soundBankManager.addSoundBank(bank.slice(0), 'main');
  await synth.isReady;
  const seq = new Sequencer(synth);
  seq.loadNewSongList([{ binary: data.slice(0), fileName: file.name }]);
  seq.loopCount = 0;

  const name = midi.getName?.() || file.name;
  const time = el('span', { class: 'time' }, '0:00 / ' + fmt(midi.duration));
  const bar = el('input', { type: 'range', min: 0, max: Math.ceil(midi.duration), value: 0, step: 1, 'aria-label': 'Position' });
  const play = el('button', { type: 'button', class: 'btn' }, 'Play');
  let playing = false;
  play.addEventListener('click', async () => {
    await ctx.resume();
    if (playing) seq.pause(); else seq.play();
    playing = !playing;
    play.textContent = playing ? 'Pause' : 'Play';
  });
  bar.addEventListener('input', () => { seq.currentTime = Number(bar.value); });
  setInterval(() => {
    if (!playing) return;
    bar.value = seq.currentTime;
    time.textContent = fmt(seq.currentTime) + ' / ' + fmt(midi.duration);
  }, 250);
  seq.eventHandler.addEvent('songEnded', 'ui', () => { playing = false; play.textContent = 'Play'; });

  ui.output.append(el('div', { class: 'player' }, el('div', { class: 'player-title' }, name), el('div', { class: 'player-controls' }, play, bar, time)));
  ui.done();

  ui.action('Save as WAV', async () => {
    ui.progress('Rendering audio…');
    const rate = 44100;
    const offline = new OfflineAudioContext({ numberOfChannels: 2, sampleRate: rate, length: Math.ceil((midi.duration + 2) * rate) });
    await offline.audioWorklet.addModule(PROCESSOR);
    const osynth = new WorkletSynthesizer(offline);
    osynth.connect(offline.destination);
    await osynth.startOfflineRender({ midiSequence: midi, loopCount: 0, soundBankList: [{ bankOffset: 0, soundBankBuffer: bank.slice(0) }] });
    const rendered = await offline.startRendering();
    ui.progress('');
    return audioBufferToWav(rendered);
  }, ui.baseName + '.wav', 'wav');
}
