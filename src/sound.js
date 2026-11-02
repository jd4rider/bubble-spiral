// Synthesised audio: no files, nothing to license, and nothing loads until the
// first user gesture.

let ctx = null
export const audioState = { muted: false }

function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return null
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function tone(freq, { type = 'sine', dur = 0.16, gain = 0.09, delay = 0 } = {}) {
  if (audioState.muted || !Number.isFinite(freq)) return
  const a = audio()
  if (!a) return
  const start = a.currentTime + delay
  const osc = a.createOscillator()
  const amp = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(amp).connect(a.destination)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

function noise({ dur = 0.22, gain = 0.05, from = 2400, to = 400, delay = 0 } = {}) {
  if (audioState.muted) return
  const a = audio()
  if (!a) return
  const start = a.currentTime + delay
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let i = 0; i < channel.length; i += 1) {
    channel[i] = (Math.random() * 2 - 1) * (1 - i / channel.length) ** 2
  }
  const source = a.createBufferSource()
  source.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(from, start)
  filter.frequency.exponentialRampToValueAtTime(to, start + dur)
  const amp = a.createGain()
  amp.gain.value = gain
  source.connect(filter).connect(amp).connect(a.destination)
  source.start(start)
}

const scale = [0, 2, 4, 7, 9, 12, 14, 16]

export const sfx = {
  fire: () => {
    tone(520, { type: 'triangle', dur: 0.09, gain: 0.06 })
    noise({ dur: 0.12, gain: 0.025, from: 3200, to: 900 })
  },
  insert: () => tone(330, { type: 'sine', dur: 0.08, gain: 0.055 }),
  thaw: () => {
    noise({ dur: 0.3, gain: 0.045, from: 3600, to: 1000 })
    tone(720, { type: 'sine', dur: 0.16, gain: 0.04, delay: 0.04 })
  },
  pop: (combo = 1) => {
    const step = scale[Math.min(scale.length - 1, combo - 1)]
    tone(523.25 * 2 ** (step / 12), { type: 'triangle', dur: 0.16, gain: 0.08 })
    tone(1046.5 * 2 ** (step / 12), { type: 'sine', dur: 0.09, gain: 0.025, delay: 0.01 })
    noise({ dur: 0.12, gain: 0.03, from: 2600, to: 600 })
  },
  combo: (combo = 2) => {
    for (let i = 0; i < Math.min(4, combo); i += 1) {
      tone(660 * 2 ** ((i * 3) / 12), { type: 'square', dur: 0.09, gain: 0.03, delay: i * 0.06 })
    }
  },
  power: () => {
    tone(440, { type: 'sawtooth', dur: 0.1, gain: 0.03 })
    tone(880, { type: 'triangle', dur: 0.2, gain: 0.05, delay: 0.06 })
  },
  reverse: () => {
    tone(500, { type: 'sawtooth', dur: 0.14, gain: 0.04 })
    tone(300, { type: 'sawtooth', dur: 0.18, gain: 0.04, delay: 0.1 })
  },
  click: () => tone(620, { type: 'triangle', dur: 0.05, gain: 0.045 }),
  win: () => {
    ;[0, 4, 7, 12, 16].forEach((step, i) => {
      tone(523.25 * 2 ** (step / 12), { type: 'triangle', dur: 0.4, gain: 0.08, delay: i * 0.09 })
    })
  },
  lose: () => [7, 3, 0, -5].forEach((step, i) => tone(392 * 2 ** (step / 12), { type: 'sine', dur: 0.3, gain: 0.05, delay: i * 0.14 })),
  tick: () => tone(880, { type: 'square', dur: 0.04, gain: 0.025 }),
}
