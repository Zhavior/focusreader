export type FocusSoundscapeId =
  | "deep-brown"
  | "balanced-pink"
  | "gentle-rain"
  | "low-fan";

export interface FocusSoundscapePreset {
  id: FocusSoundscapeId;
  label: string;
  description: string;
  gain: number;
}

export const FOCUS_SOUNDSCAPE_PRESETS: readonly FocusSoundscapePreset[] = [
  {
    id: "deep-brown",
    label: "Deep Brown",
    description: "Warm, low-frequency masking.",
    gain: 0.09,
  },
  {
    id: "balanced-pink",
    label: "Balanced Pink",
    description: "Natural, even masking for longer listening.",
    gain: 0.08,
  },
  {
    id: "gentle-rain",
    label: "Gentle Rain",
    description: "Soft organic movement without sharp drops.",
    gain: 0.085,
  },
  {
    id: "low-fan",
    label: "Low Fan",
    description: "Stable mechanical masking with minimal variation.",
    gain: 0.075,
  },
] as const;

type WebkitWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

const BUFFER_SECONDS = 12;
const FADE_SECONDS = 0.35;

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function generateDeepBrown(
  output: Float32Array,
  sampleRate: number,
  channelOffset: number
): void {
  let previous = channelOffset;

  for (let index = 0; index < output.length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = (previous + 0.015 * white) / 1.015;
    output[index] = clampSample(previous * 3.2);
  }
}

function generateBalancedPink(
  output: Float32Array,
  sampleRate: number,
  channelOffset: number
): void {
  void sampleRate;

  let b0 = channelOffset;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;

  for (let index = 0; index < output.length; index += 1) {
    const white = Math.random() * 2 - 1;

    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;

    const pink =
      (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) *
      0.105;

    b6 = white * 0.115926;
    output[index] = clampSample(pink);
  }
}

function generateGentleRain(
  output: Float32Array,
  sampleRate: number,
  channelOffset: number
): void {
  let low = channelOffset;
  let dropSamplesRemaining = 0;
  let dropLength = 1;

  for (let index = 0; index < output.length; index += 1) {
    const white = Math.random() * 2 - 1;
    low = low * 0.985 + white * 0.015;

    if (dropSamplesRemaining <= 0 && Math.random() < 1 / 4200) {
      dropLength = Math.floor(sampleRate * (0.025 + Math.random() * 0.045));
      dropSamplesRemaining = dropLength;
    }

    let drop = 0;

    if (dropSamplesRemaining > 0) {
      const progress = 1 - dropSamplesRemaining / dropLength;
      const envelope = Math.sin(progress * Math.PI);
      drop = white * envelope * 0.085;
      dropSamplesRemaining -= 1;
    }

    output[index] = clampSample(low * 0.42 + white * 0.045 + drop);
  }
}

function generateLowFan(
  output: Float32Array,
  sampleRate: number,
  channelOffset: number
): void {
  let filtered = channelOffset;
  let phase = channelOffset > 0 ? Math.PI * 0.5 : 0;
  const baseFrequency = 58;

  for (let index = 0; index < output.length; index += 1) {
    const white = Math.random() * 2 - 1;
    filtered = filtered * 0.975 + white * 0.025;

    phase += (2 * Math.PI * baseFrequency) / sampleRate;

    const motor =
      Math.sin(phase) * 0.055 +
      Math.sin(phase * 2.01) * 0.022 +
      Math.sin(phase * 3.02) * 0.01;

    output[index] = clampSample(filtered * 0.52 + motor);
  }
}

function applyLoopCrossfade(
  output: Float32Array,
  sampleRate: number
): void {
  const fadeLength = Math.min(
    Math.floor(sampleRate * FADE_SECONDS),
    Math.floor(output.length / 4)
  );

  if (fadeLength <= 0) return;

  const tailStart = output.length - fadeLength;
  const tail = output.slice(tailStart);

  for (let index = 0; index < fadeLength; index += 1) {
    const fraction = index / Math.max(1, fadeLength - 1);
    const headGain = Math.sin(fraction * Math.PI * 0.5);
    const tailGain = Math.cos(fraction * Math.PI * 0.5);

    output[index] =
      output[index] * headGain + tail[index] * tailGain;
  }
}

function createPresetBuffer(
  context: AudioContext,
  preset: FocusSoundscapeId
): AudioBuffer {
  const length = Math.floor(context.sampleRate * BUFFER_SECONDS);
  const buffer = context.createBuffer(2, length, context.sampleRate);

  for (let channel = 0; channel < 2; channel += 1) {
    const output = buffer.getChannelData(channel);
    const offset = channel === 0 ? 0.0001 : -0.0001;

    switch (preset) {
      case "deep-brown":
        generateDeepBrown(output, context.sampleRate, offset);
        break;
      case "balanced-pink":
        generateBalancedPink(output, context.sampleRate, offset);
        break;
      case "gentle-rain":
        generateGentleRain(output, context.sampleRate, offset);
        break;
      case "low-fan":
        generateLowFan(output, context.sampleRate, offset);
        break;
    }

    applyLoopCrossfade(output, context.sampleRate);
  }

  return buffer;
}

export class FocusSoundscapeEngine {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private readonly buffers = new Map<FocusSoundscapeId, AudioBuffer>();
  private activePreset: FocusSoundscapeId | null = null;

  private getAudioContextConstructor(): typeof AudioContext | null {
    if (typeof window === "undefined") return null;

    const browserWindow = window as WebkitWindow;

    return (
      browserWindow.AudioContext ??
      browserWindow.webkitAudioContext ??
      null
    );
  }

  private async ensureContext(): Promise<AudioContext | null> {
    if (!this.context) {
      const AudioContextConstructor = this.getAudioContextConstructor();
      if (!AudioContextConstructor) return null;

      this.context = new AudioContextConstructor();
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    return this.context;
  }

  private getPreset(id: FocusSoundscapeId): FocusSoundscapePreset {
    const preset = FOCUS_SOUNDSCAPE_PRESETS.find(
      (candidate) => candidate.id === id
    );

    if (!preset) {
      throw new Error(`Unknown focus soundscape: ${id}`);
    }

    return preset;
  }

  private getBuffer(
    context: AudioContext,
    preset: FocusSoundscapeId
  ): AudioBuffer {
    const cached = this.buffers.get(preset);
    if (cached) return cached;

    const buffer = createPresetBuffer(context, preset);
    this.buffers.set(preset, buffer);
    return buffer;
  }

  async play(presetId: FocusSoundscapeId): Promise<void> {
    const context = await this.ensureContext();
    if (!context) return;

    if (this.activePreset === presetId && this.source) return;

    this.stop();

    const preset = this.getPreset(presetId);

    if (!this.gain) {
      this.gain = context.createGain();
      this.gain.connect(context.destination);
    }

    this.gain.gain.cancelScheduledValues(context.currentTime);
    this.gain.gain.setValueAtTime(0, context.currentTime);
    this.gain.gain.setTargetAtTime(
      preset.gain,
      context.currentTime,
      0.08
    );

    const source = context.createBufferSource();
    source.buffer = this.getBuffer(context, presetId);
    source.loop = true;
    source.connect(this.gain);
    source.start();

    source.onended = () => {
      if (this.source === source) {
        this.source = null;
        this.activePreset = null;
      }
    };

    this.source = source;
    this.activePreset = presetId;
  }

  stop(): void {
    const context = this.context;
    const source = this.source;
    const gain = this.gain;

    this.source = null;
    this.activePreset = null;

    if (!context) return;

    if (gain) {
      gain.gain.cancelScheduledValues(context.currentTime);
      gain.gain.setTargetAtTime(0, context.currentTime, 0.04);
    }

    if (source) {
      try {
        source.stop(context.currentTime + 0.18);
      } catch {
        // The source may already have stopped.
      }

      window.setTimeout(() => {
        try {
          source.disconnect();
        } catch {
          // It may already be disconnected.
        }
      }, 220);
    }
  }

  async dispose(): Promise<void> {
    this.stop();
    this.buffers.clear();

    if (this.context && this.context.state !== "closed") {
      await this.context.close();
    }

    this.context = null;
    this.gain = null;
  }

  getActivePreset(): FocusSoundscapeId | null {
    return this.activePreset;
  }
}
