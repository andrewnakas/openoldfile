// Runs 7-Zip (compiled to WebAssembly) off the main thread.
//
// In:  { file: File, password?: string }
// Out: { ok: true, entries: [{ path, data: ArrayBuffer }] }
//      { ok: false, error: 'password' | 'decode', log }
//
// The archive is mounted read-only with WORKERFS, so it is never copied into
// the wasm heap; extracted files land in the in-memory FS and are transferred
// back without a copy.

import SevenZip from '7z-wasm';

let modulePromise = null;
let log = [];

function load() {
  modulePromise ??= SevenZip({
    locateFile: () => '/vendor/7z/7zz.wasm',
    print: (line) => log.push(line),
    printErr: (line) => log.push(line)
  });
  return modulePromise;
}

function walk(FS, dir, out = []) {
  for (const name of FS.readdir(dir)) {
    if (name === '.' || name === '..') continue;
    const path = dir + '/' + name;
    const st = FS.stat(path);
    if (FS.isDir(st.mode)) walk(FS, path, out);
    else out.push(path);
  }
  return out;
}

function rmrf(FS, dir) {
  for (const name of FS.readdir(dir)) {
    if (name === '.' || name === '..') continue;
    const path = dir + '/' + name;
    if (FS.isDir(FS.stat(path).mode)) rmrf(FS, path);
    else FS.unlink(path);
  }
  FS.rmdir(dir);
}

let run = 0;

self.onmessage = async ({ data }) => {
  log = [];
  const id = ++run;
  const mount = `/in${id}`;
  const out = `/out${id}`;
  try {
    const sz = await load();
    const { FS } = sz;
    FS.mkdir(mount);
    FS.mount(sz.WORKERFS, { files: [data.file] }, mount);
    FS.mkdir(out);
    const args = ['x', `${mount}/${data.file.name}`, `-o${out}`, '-y', '-bd', '-sccUTF-8'];
    // Always pass -p so 7-Zip never waits on stdin for a password.
    args.push('-p' + (data.password || ''));
    try {
      sz.callMain(args);
    } catch (e) {
      // callMain throws ExitStatus on a non-zero exit; the log says why.
    }
    const text = log.join('\n');
    const files = walk(FS, out);
    if (!files.length) {
      const error = /Wrong password|encrypted/i.test(text) ? 'password' : 'decode';
      self.postMessage({ ok: false, error, log: text });
    } else {
      const entries = files.map((p) => {
        const bytes = FS.readFile(p);
        return { path: p.slice(out.length + 1), data: bytes.buffer };
      });
      self.postMessage({ ok: true, entries, log: text, partial: /ERROR|Data Error|CRC Failed/i.test(text) },
        entries.map((e) => e.data));
    }
    rmrf(FS, out);
    FS.unmount(mount);
    FS.rmdir(mount);
  } catch (err) {
    self.postMessage({ ok: false, error: 'decode', log: String(err && err.stack || err) + '\n' + log.join('\n') });
  }
};
