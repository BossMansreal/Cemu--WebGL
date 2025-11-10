// js/audio.js - a simple WebAudio pull model. Feeds zeros if no samples available.
// Adapt to your core's sample API (e.g. WASM-provided ring buffer).

export function createAudioEngine(sampleRate = 44100) {
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioContextCtor({ sampleRate });
  const bufferSize = 1024;

  // Use ScriptProcessor for widest compatibility (AudioWorklet preferred but more setup)
  const node = ctx.createScriptProcessor(bufferSize, 0, 2);

  // Placeholder circular sample buffer (float32)
  const channelBufferL = new Float32Array(65536);
  const channelBufferR = new Float32Array(65536);
  let writeIdx = 0;
  let readIdx = 0;

  node.onaudioprocess = (event) => {
    const outL = event.outputBuffer.getChannelData(0);
    const outR = event.outputBuffer.getChannelData(1);
    for (let i = 0; i < outL.length; i++) {
      if (readIdx !== writeIdx) {
        outL[i] = channelBufferL[readIdx % channelBufferL.length];
        outR[i] = channelBufferR[readIdx % channelBufferR.length];
        readIdx++;
      } else {
        // underrun — output silence
        outL[i] = 0;
        outR[i] = 0;
      }
    }
  };

  node.connect(ctx.destination);

  return {
    start: () => ctx.resume(),
    stop: () => ctx.suspend(),
    // feedFloat32 interleaved arrays or separate channel arrays
    feed: (leftFloat32, rightFloat32) => {
      if (!leftFloat32 || !rightFloat32) return;
      for (let i = 0; i < leftFloat32.length; i++) {
        channelBufferL[writeIdx % channelBufferL.length] = leftFloat32[i];
        channelBufferR[writeIdx % channelBufferR.length] = rightFloat32[i];
        writeIdx++;
      }
    }
  };
}

