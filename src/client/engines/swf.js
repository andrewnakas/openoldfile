// Flash movies (.swf), played by Ruffle — an open-source Flash Player
// emulator in Rust/WebAssembly. Ruffle's self-hosted build is a classic
// script that finds its core and wasm files next to itself.

import { OpenError, el, bytes } from '../ui-kit.js';

let loading = null;
function loadRuffle() {
  if (window.RufflePlayer?.newest) return Promise.resolve();
  window.RufflePlayer = window.RufflePlayer || {};
  window.RufflePlayer.config = {
    publicPath: '/vendor/ruffle/',
    polyfills: false,
    autoplay: 'on',
    unmuteOverlay: 'visible',
    splashScreen: false,
    contextMenu: 'on',
    letterbox: 'on',
    allowScriptAccess: false,
    // No network: a movie that fetches extra files from its old website will
    // not find them, which the FAQ explains.
    openUrlMode: 'deny'
  };
  loading ??= new Promise((resolve, reject) => {
    const s = el('script', { src: '/vendor/ruffle/ruffle.js' });
    s.onload = resolve;
    s.onerror = () => reject(new OpenError('codec_load', 'The Flash emulator failed to download. Reload the page and try again.'));
    document.head.append(s);
  });
  return loading;
}

export async function open(file, ui) {
  ui.progress('Starting the Flash emulator…');
  const data = await bytes(file);
  await loadRuffle();
  const player = window.RufflePlayer.newest().createPlayer();
  player.classList.add('swf-player');
  ui.output.append(el('div', { class: 'swf-stage' }, player));
  await player.ruffle().load({ data: data.buffer, swfFileName: file.name });
  ui.done();
  ui.button('Full screen', () => player.ruffle().enterFullscreen?.() ?? player.requestFullscreen?.(), 'btn');
}
