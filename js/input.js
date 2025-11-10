// js/input.js - local-only keyboard + gamepad mapping
// This module expects the wasm glue to expose functions to set key/button state.
// Adjust function names if your core uses different exports.

export function setupInput() {
  // Map keyboard keys to generic emulator buttons
  const keyMap = {
    'ArrowUp': 'UP',
    'ArrowDown': 'DOWN',
    'ArrowLeft': 'LEFT',
    'ArrowRight': 'RIGHT',
    'z': 'A',
    'x': 'B',
    'Enter': 'START',
    'Shift': 'SELECT'
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key;
    const btn = keyMap[k];
    if (!btn) return;
    if (typeof WasmBoy !== 'undefined') {
      // Try several possible setters
      if (typeof WasmBoy._setButtonPressed === 'function') {
        WasmBoy._setButtonPressed(btn, 1);
      } else if (typeof WasmBoy.setButton === 'function') {
        WasmBoy.setButton(btn, true);
      } else if (typeof WasmBoy.setKeyPressed === 'function') {
        WasmBoy.setKeyPressed(btn, true);
      }
    }
    e.preventDefault();
  }, false);

  window.addEventListener('keyup', (e) => {
    const k = e.key;
    const btn = keyMap[k];
    if (!btn) return;
    if (typeof WasmBoy !== 'undefined') {
      if (typeof WasmBoy._setButtonPressed === 'function') {
        WasmBoy._setButtonPressed(btn, 0);
      } else if (typeof WasmBoy.setButton === 'function') {
        WasmBoy.setButton(btn, false);
      } else if (typeof WasmBoy.setKeyPressed === 'function') {
        WasmBoy.setKeyPressed(btn, false);
      }
    }
    e.preventDefault();
  }, false);

  // Gamepad polling
  function pollGamepads() {
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    const g = gps[0];
    if (g) {
      // A common mapping: button 0 = A, 1 = B, 9 = Start, 8 = Select
      if (g.buttons[0]?.pressed) { if (WasmBoy && WasmBoy._setButtonPressed) WasmBoy._setButtonPressed('A', 1); }
      else { if (WasmBoy && WasmBoy._setButtonPressed) WasmBoy._setButtonPressed('A', 0); }

      if (g.buttons[1]?.pressed) { if (WasmBoy && WasmBoy._setButtonPressed) WasmBoy._setButtonPressed('B', 1); }
      else { if (WasmBoy && WasmBoy._setButtonPressed) WasmBoy._setButtonPressed('B', 0); }

      // D-pad ---- convert axes/hat if needed
      if (g.axes) {
        const ax0 = g.axes[0], ax1 = g.axes[1];
        if (ax0 < -0.5) WasmBoy._setButtonPressed('LEFT', 1); else WasmBoy._setButtonPressed('LEFT', 0);
        if (ax0 > 0.5)  WasmBoy._setButtonPressed('RIGHT', 1); else WasmBoy._setButtonPressed('RIGHT', 0);
        if (ax1 < -0.5) WasmBoy._setButtonPressed('UP', 1); else WasmBoy._setButtonPressed('UP', 0);
        if (ax1 > 0.5)  WasmBoy._setButtonPressed('DOWN', 1); else WasmBoy._setButtonPressed('DOWN', 0);
      }
    }
    requestAnimationFrame(pollGamepads);
  }
  pollGamepads();
}

