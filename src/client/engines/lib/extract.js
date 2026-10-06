// Extract any archive 7-Zip understands, in a worker. Resolves to
// [{ path, data: Uint8Array }]. Throws OpenError on failure.

import { OpenError } from '../../ui-kit.js';

let worker = null;

export function extract(file, password) {
  worker ??= new Worker('/js/workers/7z-worker.js', { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.ok) {
        const entries = data.entries.map((e) => ({ path: e.path, data: new Uint8Array(e.data) }));
        // 7-Zip extracted what it could but reported CRC or data errors.
        entries.partial = !!data.partial;
        return resolve(entries);
      }
      console.warn(data.log);
      if (data.error === 'password') return reject(new OpenError('password', 'This archive is password-protected.'));
      reject(new OpenError('decode', 'This archive could not be extracted. It may be damaged, incomplete (one part of a multi-part set), or a variant 7-Zip does not read.'));
    };
    worker.onerror = (e) => {
      worker = null;
      reject(new OpenError('codec_load', 'The extractor failed to start. Reload the page and try again.'));
    };
    worker.postMessage({ file, password });
  });
}
