// main.js - local-only imports. No remote network usage.
import { createRenderer } from './js/renderer.js';
import { setupInput } from './js/input.js';
import { createAudioEngine } from './js/audio.js';
import { Storage } from './js/storage.js';

// NOTE: wasmboy.js is a local script in ./wasm/ ; we load it as a local script tag.
// It should expose a global (e.g. WasmBoy) as per that build. If your core uses a different name,
// change references below.
function loadLocalWasmGlue() {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-local-wasm]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed loading wasm glue')));
      return;
    }
    const s = document.createElement('script');
    s.src = './wasm/wasmboy.js'; // local file in repo
    s.setAttribute('data-local-wasm', '1');
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.body.appendChild(s);
  });
}

const romInput = document.getElementById('romInput');
const startBtn = document.getElementById('startBtn');

let romArrayBuffer = null;
let emulatorReady = false;

romInput.addEventListener('change', async (evt) => {
  const f = evt.target.files[0];
  if (!f) return;
  romArrayBuffer = await f.arrayBuffer();
  console.log('Loaded ROM from local file:', f.name, romArrayBuffer.byteLength, 'bytes');
});

// Main start button: loads local wasm glue, initializes emulator and rendering
startBtn.addEventListener('click', async () => {
  if (!romArrayBuffer) {
    alert('Please choose a ROM file first with the file picker.');
    return;
  }

  try {
    await loadLocalWasmGlue(); // load ./wasm/wasmboy.js locally
  } catch (e) {
    console.error('Failed to load local wasm glue:', e);
    alert('Failed to load local wasm glue (see console).');
    return;
  }

  // Some WASM glue builds export a factory function (Module) or a global object.
  // Example: WasmBoy (prebuilt) exposes a WasmBoy global with load/init functions.
  // Adjust below if your particular local core uses a different API.
  if (typeof WasmBoy === 'undefined') {
    console.error('WASM glue loaded but global WasmBoy not found. Check wasm/wasmboy.js presence.');
    alert('WASM glue loaded but WasmBoy global not found.');
    return;
  }

  // Provide local wasm binary via local path or via ArrayBuffer depending on glue API.
  // Many glue scripts accept a `wasmBinaryFile` path (relative) or `wasmBinary`/binary buffer.
  const wasmInitOptions = {
    // prefer to pass in-memory binary if glue supports it (avoid browser fetch).
    // Try to load the local wasm binary via fetch from same origin; if you prefer strictly no fetch,
    // you can read the file into memory and pass as Uint8Array below — but since we didn't pick a
    // file input for wasm, we assume the .wasm file is present at ./wasm/wasmboy.wasm and that
    // the glue can load it from there (same origin).
    wasmBinaryFile: './wasm/wasmboy.wasm',
    // custom: some builds accept "wasmBinary" as ArrayBuffer. Uncomment to pass binary directly:
    // wasmBinary: await (await fetch('./wasm/wasmboy.wasm')).arrayBuffer()
  };

  // If your glue expects a load() function returning a promise:
  try {
    if (typeof WasmBoy.load === 'function') {
      // Some builds accept a `game` parameter to load ROM bytes directly:
      await WasmBoy.load({
        ...wasmInitOptions,
        game: new Uint8Array(romArrayBuffer) // pass ROM bytes directly (local-only)
      });
    } else if (typeof WasmBoy === 'function') {
      // Emscripten modularized, e.g. Module() factory
      await WasmBoy(wasmInitOptions);
      // init emulator, then load ROM via provided API (adjust names as needed)
      if (typeof WasmBoy._loadROM === 'function') {
        // copy ROM into HEAP and call _loadROM(ptr, size) — depends on glue internals
        const rom = new Uint8Array(romArrayBuffer);
        const ptr = WasmBoy._malloc(rom.length);
        WasmBoy.HEAPU8.set(rom, ptr);
        WasmBoy._loadROM(ptr, rom.length);
        WasmBoy._free(ptr);
      }
    } else {
      console.warn('Unrecognized WasmBoy glue shape. Proceeding optimistically.');
    }
  } catch (e) {
    console.warn('WASM init/load may have failed or used a different API. Continuing anyway.', e);
  }

  // Now set up renderer, audio, input, storage
  const targetWidth = 160;  // change as appropriate for your core
  const targetHeight = 144;

  const { updateTexture, render } = createRenderer(targetWidth, targetHeight);
  setupInput();            // maps keyboard + gamepad to global WasmBoy functions
  const audio = createAudioEngine();
  audio.start();

  // Render loop: call the emulator's frame-runner (name differs per core)
  function frameLoop() {
    requestAnimationFrame(frameLoop);

    // Run one emulated frame. Many cores expose a function like `_runFrame()` or similar.
    // Try several common names; adapt if your glue uses others.
    if (typeof WasmBoy._runFrame === 'function') {
      WasmBoy._runFrame();
    } else if (typeof WasmBoy.runFrame === 'function') {
      WasmBoy.runFrame();
    } else if (typeof WasmBoy.run === 'function') {
      WasmBoy.run(); // maybe starts a loop internally (check your glue)
    }

    // Pull framebuffer bytes (4-channel RGBA) from emulator. Adjust API to match glue.
    let frame = null;
    if (typeof WasmBoy._getFramebuffer === 'function') {
      frame = WasmBoy._getFramebuffer(); // maybe returns Uint8Array
    } else if (typeof WasmBoy.getFramebuffer === 'function') {
      frame = WasmBoy.getFramebuffer();
    } else if (typeof WasmBoy.framebuffer !== 'undefined') {
      frame = WasmBoy.framebuffer;
    }

    if (frame) {
      // frame might be pointer/HEAPU8 subarray or direct Uint8Array — just pass to updateTexture
      updateTexture(frame);
    }

    // Audio: many cores fill a sample buffer you can read from; adapt as needed.
    // Example: if WasmBoy._getAudioSamples(ptr, count) exists, copy and feed audio.feedSamples(...)
    render();
  }

  frameLoop();
  emulatorReady = true;
  console.log('Emulator started (local-only).');
});

