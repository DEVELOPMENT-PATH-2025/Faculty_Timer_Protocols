/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioContext: AudioContext | null = null;
let currentOscillator: OscillatorNode | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
}

export const playBeep = (durationSec: number) => {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, ctx.currentTime); // A5 note

  // Beeping effect (pulsing)
  const beepOn = 0.5;
  const beepOff = 0.2;
  const total = beepOn + beepOff;
  
  for (let i = 0; i < durationSec; i += total) {
    gainNode.gain.setValueAtTime(0.5, ctx.currentTime + i);
    gainNode.gain.setValueAtTime(0, ctx.currentTime + i + beepOn);
  }

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + durationSec);
  
  currentOscillator = oscillator;
};

export const stopBeep = () => {
  if (currentOscillator) {
    try {
      currentOscillator.stop();
    } catch (e) {
      // already stopped
    }
    currentOscillator = null;
  }
};
