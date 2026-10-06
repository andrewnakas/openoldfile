// RealMedia (.rm, .rmvb, .ra), converted with FFmpeg (WebAssembly) to MP4 or
// MP3. FFmpeg's core (~31 MB) is too large for a Pages file, so it comes from
// jsDelivr as shrinkvideo.com does, and the browser caches it after the
// first conversion. The file itself never leaves the device.

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { OpenError, el } from '../ui-kit.js';

const CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm/';

let ready = null;
function load(ui) {
  ready ??= (async () => {
    const ffmpeg = new FFmpeg();
    ui.progress('Downloading the converter (31 MB, once)…');
    await ffmpeg.load({
      coreURL: await toBlobURL(CORE + 'ffmpeg-core.js', 'text/javascript'),
      wasmURL: await toBlobURL(CORE + 'ffmpeg-core.wasm', 'application/wasm'),
      classWorkerURL: '/vendor/ffmpeg/worker.js'
    });
    return ffmpeg;
  })().catch((err) => {
    ready = null;
    throw new OpenError('codec_load', 'The converter failed to download. Check your connection and try again.');
  });
  return ready;
}

export async function open(file, ui) {
  const ffmpeg = await load(ui);
  const input = 'in.' + (ui.ext || 'rm');
  await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));

  // Ask ffmpeg what is inside: a video stream means MP4, otherwise MP3.
  let probe = '';
  const onLog = ({ message }) => { probe += message + '\n'; };
  ffmpeg.on('log', onLog);
  await ffmpeg.exec(['-hide_banner', '-i', input]);
  ffmpeg.off('log', onLog);
  const hasVideo = /Stream #.*Video:/.test(probe);
  const hasAudio = /Stream #.*Audio:/.test(probe);
  if (!hasVideo && !hasAudio) {
    await ffmpeg.deleteFile(input);
    throw new OpenError('decode', /Invalid data|could not find codec|Unknown/i.test(probe)
      ? 'This file is not a playable RealMedia file. A .ram file is only a link to a stream, not the media itself.'
      : 'No audio or video could be read from this file.');
  }

  const output = hasVideo ? 'out.mp4' : 'out.mp3';
  const onProgress = ({ progress }) => ui.progress(`Converting… ${Math.max(0, Math.min(100, Math.round(progress * 100)))}%`);
  ffmpeg.on('progress', onProgress);
  const args = hasVideo
    ? ['-i', input, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output]
    : ['-i', input, '-c:a', 'libmp3lame', '-q:a', '2', output];
  const code = await ffmpeg.exec(args);
  ffmpeg.off('progress', onProgress);
  await ffmpeg.deleteFile(input);
  if (code !== 0) throw new OpenError('decode', 'The conversion failed partway. The file may be damaged or use a RealMedia codec FFmpeg does not decode.');

  const data = await ffmpeg.readFile(output);
  await ffmpeg.deleteFile(output);
  const blob = new Blob([data], { type: hasVideo ? 'video/mp4' : 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  ui.output.append(hasVideo ? el('video', { class: 'media-out', controls: true, src: url }) : el('audio', { class: 'media-out', controls: true, src: url }),
    el('p', { class: 'note' }, hasVideo ? 'Converted to MP4 (H.264 + AAC).' : 'Converted to MP3.'));
  ui.done();
  ui.action(hasVideo ? 'Download MP4' : 'Download MP3', () => blob, ui.baseName + (hasVideo ? '.mp4' : '.mp3'), hasVideo ? 'mp4' : 'mp3');
}
