const TRACK_NO_TAG = "jan_launcher_no_tag.mp3";
const TRACK_TAG = "jan_launcher_tag.mp3";
const RARE_TRACK_PROBABILITY = 0.03;

const BASE_URL =
  typeof import.meta.env.BASE_URL === "string" ? import.meta.env.BASE_URL : "./";

function getAudioUrl(filename: string): string {
  return BASE_URL + "audio/" + encodeURIComponent(filename);
}

function pickTrack(): string {
  return Math.random() < RARE_TRACK_PROBABILITY ? TRACK_TAG : TRACK_NO_TAG;
}

function clampVolume(v: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
}

class AudioServiceImpl {
  private audio: HTMLAudioElement | null = null;
  private volume = 0;
  private trackSrc: string | null = null;
  private unloadBound = false;

  init(volume: number): void {
    const v = clampVolume(volume);
    if (this.audio !== null) {
      this.volume = v;
      this.audio.volume = v;
      if (v === 0) this.stop();
      return;
    }
    const filename = pickTrack();
    this.trackSrc = getAudioUrl(filename);
    this.audio = new Audio(this.trackSrc);
    this.audio.loop = true;
    this.volume = v;
    this.audio.volume = v;

    if (!this.unloadBound) {
      this.unloadBound = true;
      const stopOnUnload = () => {
        this.stop();
      };
      window.addEventListener("beforeunload", stopOnUnload);
      window.addEventListener("pagehide", stopOnUnload);
    }
  }

  play(): void {
    if (this.volume <= 0 || this.audio === null) return;
    const p = this.audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        this.tryPlayAfterUserInteraction();
      });
    }
  }

  private tryPlayAfterUserInteraction(): void {
    if (this.audio === null) return;
    const events = ["click", "keydown", "touchstart"] as const;
    let resolved = false;
    const tryPlay = () => {
      if (resolved) return;
      resolved = true;
      events.forEach((ev) => {
        document.removeEventListener(ev, tryPlay);
        window.removeEventListener(ev, tryPlay);
      });
      if (this.volume > 0 && this.audio) {
        this.audio.play().catch(() => {});
      }
    };
    events.forEach((ev) => {
      document.addEventListener(ev, tryPlay);
      window.addEventListener(ev, tryPlay);
    });
  }

  stop(): void {
    if (this.audio === null) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  setVolume(value: number): void {
    const v = clampVolume(value);
    this.volume = v;
    if (this.audio) {
      this.audio.volume = v;
      if (v === 0) {
        this.stop();
      } else {
        this.play();
      }
    }
  }

  isPlaying(): boolean {
    return !!(this.audio && !this.audio.paused);
  }
}

export const AudioService = new AudioServiceImpl();
