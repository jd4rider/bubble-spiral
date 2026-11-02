// Shared presentation: palettes, typography, buttons and generated textures.
// No image or font files are shipped; everything is drawn from code.

import Phaser from 'phaser'

export const W = 640
export const H = 940
export const FONT = 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif'

export const MARBLE_HEX = {
  jade: '#34d399',
  coral: '#fb7185',
  sky: '#60a5fa',
  amber: '#fbbf24',
  violet: '#a78bfa',
  rose: '#f472b6',
  rainbow: '#e879f9',
}

export const THEMES = {
  candy: {
    name: 'Candy Spiral',
    bg: ['#fdf4ff', '#e0e7ff'],
    track: '#4338ca',
    trackEdge: '#c7d2fe',
    text: '#312e81',
    subtext: '#7c3aed',
    accent: 0xdb2777,
    accentText: '#ffffff',
    panel: 0xffffff,
    panelAlpha: 0.74,
    shadow: 0x7c3aed,
    dark: false,
  },
  ocean: {
    name: 'Ocean Pearls',
    bg: ['#ecfeff', '#bae6fd'],
    track: '#0e7490',
    trackEdge: '#a5f3fc',
    text: '#083344',
    subtext: '#0e7490',
    accent: 0x0e7490,
    accentText: '#ffffff',
    panel: 0xffffff,
    panelAlpha: 0.72,
    shadow: 0x0369a1,
    dark: false,
  },
  neon: {
    name: 'Neon Galaxy',
    bg: ['#0b1020', '#2e1065'],
    track: '#a78bfa',
    trackEdge: '#4c1d95',
    text: '#e0e7ff',
    subtext: '#a5b4fc',
    accent: 0x8b5cf6,
    accentText: '#ffffff',
    panel: 0x1e1b4b,
    panelAlpha: 0.74,
    shadow: 0x000000,
    dark: true,
  },
  jungle: {
    name: 'Jungle Jewels',
    bg: ['#f7fee7', '#bbf7d0'],
    track: '#166534',
    trackEdge: '#bbf7d0',
    text: '#14532d',
    subtext: '#15803d',
    accent: 0x15803d,
    accentText: '#f7fee7',
    panel: 0xffffff,
    panelAlpha: 0.75,
    shadow: 0x14532d,
    dark: false,
  },
}

export const THEME_KEYS = Object.keys(THEMES)

export function themeOf(name) {
  return THEMES[name] ?? THEMES.candy
}

const canvasTexture = (scene, key, width, height, draw) => {
  if (scene.textures.exists(key)) return
  const texture = scene.textures.createCanvas(key, width, height)
  draw(texture.getContext(), width, height)
  texture.refresh()
}

export function makeTextures(scene) {
  canvasTexture(scene, 'spark', 16, 16, (ctx) => {
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(8, 8, 8, 0, Math.PI * 2)
    ctx.fill()
  })
  canvasTexture(scene, 'glint', 64, 64, (ctx) => {
    const gradient = ctx.createRadialGradient(20, 18, 2, 32, 32, 30)
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)')
    gradient.addColorStop(0.4, 'rgba(255,255,255,0.15)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  })
  canvasTexture(scene, 'trackDot', 8, 8, (ctx) => {
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    ctx.beginPath()
    ctx.arc(4, 4, 4, 0, Math.PI * 2)
    ctx.fill()
  })
}

const backgroundKeys = new Set()

export function background(scene, theme, { motes = true } = {}) {
  const key = `bg-${theme.name.replace(/\s/g, '')}`
  if (!backgroundKeys.has(key)) {
    canvasTexture(scene, key, 8, H, (ctx) => {
      const gradient = ctx.createLinearGradient(0, 0, 0, H)
      gradient.addColorStop(0, theme.bg[0])
      gradient.addColorStop(1, theme.bg[1])
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 8, H)
    })
    backgroundKeys.add(key)
  }
  scene.add.image(W / 2, H / 2, key).setDisplaySize(W, H).setDepth(-100)

  if (!motes) return
  scene.add
    .particles(0, 0, 'spark', {
      x: { min: 0, max: W },
      y: H + 10,
      speedY: { min: -24, max: -8 },
      speedX: { min: -8, max: 8 },
      lifespan: 14000,
      scale: { start: 0.3, end: 0.08 },
      alpha: { start: 0.22, end: 0 },
      frequency: 460,
      tint: theme.dark ? 0xa5b4fc : 0xffffff,
    })
    .setDepth(-90)
}

export function text(scene, x, y, value, size = 22, color = '#fff', extra = {}) {
  return scene.add.text(x, y, value, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    ...extra,
  })
}

export function panel(scene, x, y, width, height, theme, { radius = 22, alpha = theme.panelAlpha } = {}) {
  const g = scene.add.graphics()
  g.fillStyle(theme.shadow, theme.dark ? 0.5 : 0.16)
  g.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 8, width, height, radius)
  g.fillStyle(theme.panel, alpha)
  g.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  g.lineStyle(2, theme.accent, 0.2)
  g.strokeRoundedRect(x - width / 2, y - height / 2, width, height, radius)
  return g
}

export function button(scene, x, y, caption, onClick, options = {}) {
  const {
    width = 200,
    height = 56,
    size = 20,
    fill = 0xdb2777,
    textColor = '#ffffff',
    radius = 16,
    theme = THEMES.candy,
    icon = '',
  } = options

  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  const draw = (alpha, lift = 0) => {
    bg.clear()
    bg.fillStyle(theme.shadow, 0.22)
    bg.fillRoundedRect(-width / 2, -height / 2 + 5 - lift, width, height, radius)
    bg.fillStyle(fill, alpha)
    bg.fillRoundedRect(-width / 2, -height / 2 - lift, width, height, radius)
    bg.lineStyle(2, 0xffffff, 0.26)
    bg.strokeRoundedRect(-width / 2, -height / 2 - lift, width, height, radius)
  }
  draw(0.95)

  const label = text(scene, 0, 0, `${icon ? `${icon}  ` : ''}${caption}`, size, textColor, {
    fontStyle: 'bold',
    align: 'center',
  }).setOrigin(0.5)

  box.add([bg, label])
  box.setSize(width, height).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => draw(1, 2))
  box.on('pointerout', () => draw(0.95))
  box.on('pointerdown', () => {
    scene.tweens.add({ targets: box, scale: 0.96, duration: 70, yoyo: true })
    onClick()
  })
  box.setCaption = (value) => label.setText(value)
  box.setEnabled = (enabled) => {
    box.setAlpha(enabled ? 1 : 0.45)
    box.disableInteractive()
    if (enabled) box.setInteractive({ useHandCursor: true })
  }
  return box
}

export function iconButton(scene, x, y, glyph, onClick, theme, size = 52) {
  const box = scene.add.container(x, y)
  const bg = scene.add.graphics()
  bg.fillStyle(theme.dark ? 0xffffff : theme.accent, 0.14)
  bg.fillCircle(0, 0, size / 2)
  bg.lineStyle(2, theme.accent, 0.3)
  bg.strokeCircle(0, 0, size / 2)
  const label = text(scene, 0, 0, glyph, size * 0.46, theme.text).setOrigin(0.5)
  box.add([bg, label])
  box.setSize(size, size).setInteractive({ useHandCursor: true })
  box.on('pointerover', () => box.setScale(1.08))
  box.on('pointerout', () => box.setScale(1))
  box.on('pointerdown', onClick)
  return box
}

export function fade(scene, target, payload) {
  scene.input.enabled = false
  scene.cameras.main.fadeOut(180, 8, 8, 20)
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(target, payload))
}

export function starString(stars, max = 3) {
  return '★'.repeat(Math.max(0, stars)) + '☆'.repeat(Math.max(0, max - stars))
}

/** A glossy marble: base disc, soft rim, and a highlight. */
export function drawMarble(scene, color, radius = 14) {
  const container = scene.add.container(0, 0)
  const base = scene.add.circle(0, 0, radius, Phaser.Display.Color.HexStringToColor(color).color, 1)
  const rim = scene.add.circle(0, 0, radius, 0xffffff, 0.001)
  rim.setStrokeStyle(Math.max(2, radius * 0.14), 0xffffff, 0.55)
  const gloss = scene.add.circle(-radius * 0.32, -radius * 0.36, radius * 0.34, 0xffffff, 0.6)
  container.add([base, rim, gloss])
  return container
}
