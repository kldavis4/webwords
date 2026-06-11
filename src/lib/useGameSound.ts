import { useCallback, useEffect, useRef, useState } from "react";

type AudioContextConstructor = typeof AudioContext;

type SoundCue = "clear" | "finish" | "invalid" | "new" | "pause" | "reset" | "resume" | "tile" | "valid";

type Tone = {
  duration: number;
  frequency: number;
  gain?: number;
  start?: number;
  type?: OscillatorType;
};

const STORAGE_KEY = "wordweb-sound-muted";

function getAudioContextConstructor(): AudioContextConstructor | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.AudioContext ?? (window as Window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
}

export function useGameSound() {
  const contextRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    const storedPreference = window.localStorage.getItem(STORAGE_KEY);

    if (storedPreference === "true") {
      setIsMuted(true);
    }
  }, []);

  const getContext = useCallback(() => {
    if (contextRef.current) {
      return contextRef.current;
    }

    const AudioContextCtor = getAudioContextConstructor();

    if (!AudioContextCtor) {
      return null;
    }

    contextRef.current = new AudioContextCtor();
    return contextRef.current;
  }, []);

  const playTone = useCallback(
    (tone: Tone) => {
      if (isMuted) {
        return;
      }

      const audioContext = getContext();

      if (!audioContext) {
        return;
      }

      void audioContext.resume();

      const start = audioContext.currentTime + (tone.start ?? 0);
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const volume = tone.gain ?? 0.045;

      oscillator.frequency.setValueAtTime(tone.frequency, start);
      oscillator.type = tone.type ?? "sine";
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.03);
    },
    [getContext, isMuted]
  );

  const play = useCallback(
    (cue: SoundCue) => {
      const cues: Record<SoundCue, Tone[]> = {
        clear: [{ duration: 0.06, frequency: 260, gain: 0.028, type: "triangle" }],
        finish: [
          { duration: 0.12, frequency: 392, gain: 0.035, type: "triangle" },
          { duration: 0.14, frequency: 523.25, gain: 0.04, start: 0.09, type: "triangle" },
          { duration: 0.22, frequency: 659.25, gain: 0.04, start: 0.2, type: "triangle" }
        ],
        invalid: [
          { duration: 0.09, frequency: 180, gain: 0.04, type: "sawtooth" },
          { duration: 0.12, frequency: 130, gain: 0.03, start: 0.08, type: "sawtooth" }
        ],
        new: [
          { duration: 0.07, frequency: 440, gain: 0.032, type: "triangle" },
          { duration: 0.07, frequency: 554.37, gain: 0.032, start: 0.06, type: "triangle" },
          { duration: 0.1, frequency: 659.25, gain: 0.034, start: 0.12, type: "triangle" }
        ],
        pause: [{ duration: 0.1, frequency: 220, gain: 0.032, type: "triangle" }],
        reset: [
          { duration: 0.06, frequency: 349.23, gain: 0.028, type: "triangle" },
          { duration: 0.08, frequency: 293.66, gain: 0.028, start: 0.06, type: "triangle" }
        ],
        resume: [
          { duration: 0.08, frequency: 329.63, gain: 0.03, type: "triangle" },
          { duration: 0.1, frequency: 440, gain: 0.032, start: 0.07, type: "triangle" }
        ],
        tile: [{ duration: 0.055, frequency: 523.25, gain: 0.026, type: "triangle" }],
        valid: [
          { duration: 0.1, frequency: 523.25, gain: 0.035, type: "triangle" },
          { duration: 0.12, frequency: 659.25, gain: 0.035, start: 0.07, type: "triangle" },
          { duration: 0.16, frequency: 783.99, gain: 0.032, start: 0.14, type: "triangle" }
        ]
      };

      for (const tone of cues[cue]) {
        playTone(tone);
      }
    },
    [playTone]
  );

  const toggleMuted = useCallback(() => {
    setIsMuted((current) => {
      const nextValue = !current;

      window.localStorage.setItem(STORAGE_KEY, String(nextValue));

      return nextValue;
    });
  }, []);

  useEffect(() => {
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  return {
    isMuted,
    play,
    toggleMuted
  };
}
