import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'res', 'raw');
fs.mkdirSync(dir, { recursive: true });

const SAMPLE_RATE = 44100;
const DURATION = 1.0;
const FREQUENCY = 880.0;
const numSamples = SAMPLE_RATE * DURATION;

const buffer = Buffer.alloc(44 + numSamples * 2);

// Wave header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + numSamples * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size
buffer.writeUInt16LE(1, 20); // AudioFormat (PCM)
buffer.writeUInt16LE(1, 22); // NumChannels
buffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
buffer.writeUInt16LE(2, 32); // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(numSamples * 2, 40);

// Wave data
for (let i = 0; i < numSamples; i++) {
  const envelope = Math.exp(-3.0 * i / SAMPLE_RATE);
  let value = Math.round(32767 * envelope * Math.sin(2 * Math.PI * FREQUENCY * i / SAMPLE_RATE));
  if (value > 32767) value = 32767;
  if (value < -32768) value = -32768;
  buffer.writeInt16LE(value, 44 + i * 2);
}

fs.writeFileSync(path.join(dir, 'beep.wav'), buffer);
console.log('beep.wav created!');
