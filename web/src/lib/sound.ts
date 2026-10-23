const SOUND_KEY = 'uec:som-pedido-novo'

/** Preferência da central: tocar ou não o som de pedido novo (por aparelho). */
export function readSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    return true
  }
}

export function writeSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, enabled ? 'on' : 'off')
  } catch {
    // sem armazenamento: o som fica ligado
  }
}

let context: AudioContext | null = null

/** "Plim-plom" de pedido novo, gerado na hora (sem arquivo de áudio). */
export function playNewOrderSound() {
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const start = context.currentTime
    for (const [frequency, offset] of [
      [988, 0],
      [1319, 0.18],
    ] as const) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start + offset)
      gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.5)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + offset)
      oscillator.stop(start + offset + 0.55)
    }
  } catch {
    // navegador sem áudio ou bloqueado antes do primeiro clique: segue sem som
  }
}
