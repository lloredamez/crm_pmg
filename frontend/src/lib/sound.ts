// Utilitário de Notificação Sonora para Novos Leads via Web Audio API
// Sintetizador harmônico limpo (estilo chime/ding-dong moderno)
// Não depende de arquivos externos, funciona offline e com latência zero.

class NotificationSound {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private listeners: Set<(enabled: boolean) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('crm_sound_enabled');
      this.soundEnabled = stored !== null ? stored === 'true' : true;

      // Desbloqueia o AudioContext na primeira interação do usuário (política do browser)
      const unlock = () => {
        this.ensureContext();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    return this.audioCtx;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm_sound_enabled', String(enabled));
    }
    this.listeners.forEach((listener) => listener(enabled));
  }

  public toggle(): boolean {
    const newState = !this.soundEnabled;
    this.setEnabled(newState);
    if (newState) {
      this.playNotification();
    }
    return newState;
  }

  public subscribe(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reproduz um som harmônico de notificação de novo lead:
   * Acorde suave em 2 tempos (Dó maior / Mi-Sol-Dó) com decaimento exponencial
   */
  public playNotification() {
    if (!this.soundEnabled || typeof window === 'undefined') return;

    try {
      const ctx = this.ensureContext();
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // 1ª Nota: G5 (783.99 Hz) - Tom de abertura
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);

      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // 2ª Nota: C6 (1046.50 Hz) - Tom principal cristalino
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.50, now + 0.12);

      gain2.gain.setValueAtTime(0.0001, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.7);

      // Leve brilho harmônico de fundo: E6 (1318.51 Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1318.51, now + 0.14);

      gain3.gain.setValueAtTime(0.0001, now + 0.14);
      gain3.gain.exponentialRampToValueAtTime(0.12, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);

      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.14);
      osc3.stop(now + 0.55);
    } catch (e) {
      console.warn('Não foi possível tocar o som de notificação:', e);
    }
  }
}

export const notificationSound = new NotificationSound();

