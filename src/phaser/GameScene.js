import Phaser from 'phaser'
import {
  W,
  H,
  MARBLE_HEX,
  background,
  button,
  drawMarble,
  fade,
  iconButton,
  panel,
  text,
  themeOf,
} from './common.js'
import { pointAt, trackPolyline } from '../chain/path.js'
import {
  MARBLE_RADIUS,
  advance,
  chainProgress,
  createChain,
  findInsertion,
  hasReachedEnd,
  insertMarble,
  isCleared,
  marbleViews,
  resolveMatches,
  thawMarble,
} from '../chain/model.js'
import { classicLevel, dailyLevel, endlessLevel, journeyLevel, zenLevel, TOTAL_LEVELS } from '../levels.js'
import { data, record } from '../save.js'
import { newlyUnlocked, starsFor } from '../progress.js'
import { sfx } from '../sound.js'

const LAUNCHER = { x: 320, y: 806 }
const SHOT_SPEED = 940
const FIRE_COOLDOWN = 0.16

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('game')
  }

  init(payload = {}) {
    this.mode = payload.mode ?? 'journey'
    this.levelNumber = payload.level ?? 1
    this.stage = payload.stage ?? 1
    this.wave = payload.wave ?? 1
    this.seed = payload.seed
    this.dailyDate = payload.date
    this.carriedScore = payload.score ?? 0
  }

  create() {
    this.theme = themeOf(data.settings.theme)
    this.level = this.resolveLevel()
    this.chain = createChain(this.level.marbles, {
      spacing: this.level.spacing,
      startS: this.level.startS,
    })
    this.marbleSprites = new Map()
    this.popping = new Set()
    this.projectiles = []
    this.score = this.carriedScore
    this.runPopped = 0
    this.runMatches = 0
    this.bestCombo = 0
    this.shotsFired = 0
    this.shotsHit = 0
    this.over = false
    this.paused = null
    this.slowUntil = 0
    this.reverseUntil = 0
    this.rainbowShot = false
    this.lastShotAt = 0
    this.aimAngle = -Math.PI / 2
    this.powerups = { slow: this.level.powerups, reverse: this.level.powerups, rainbow: this.level.powerups }
    this.queueRng = this.makeRng(`${this.level.seed}:shots`)
    this.current = this.nextColour()
    this.following = this.nextColour()

    background(this, this.theme, { motes: !data.settings.reducedMotion })
    this.cameras.main.fadeIn(180, 8, 8, 20)
    this.drawTrack()
    this.drawChrome()
    this.buildLauncher()
    this.syncChain()
    this.updateHud()
    this.bindInput()
    this.preview = this.add.graphics().setDepth(30)
  }

  makeRng(seed) {
    let a = 0
    const str = String(seed)
    for (let i = 0; i < str.length; i += 1) a = (Math.imul(a ^ str.charCodeAt(i), 16777619) + 1) >>> 0
    return () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  resolveLevel() {
    if (this.mode === 'daily') return dailyLevel(this.dailyDate)
    if (this.mode === 'zen') return zenLevel(this.seed ?? Date.now())
    if (this.mode === 'endless') return endlessLevel(this.wave)
    if (this.mode === 'classic') return classicLevel(this.stage)
    return journeyLevel(this.levelNumber)
  }

  get levelLabel() {
    if (this.mode === 'daily') return 'Daily Challenge'
    if (this.mode === 'zen') return 'Zen'
    if (this.mode === 'endless') return `Endless · Wave ${this.wave}`
    if (this.mode === 'classic') return `Classic · Stage ${this.stage}`
    return `${this.level.chapterName} · ${this.level.title}`
  }

  // ---------- scene furniture ---------------------------------------------

  drawTrack() {
    const { path } = this.level
    const points = trackPolyline(path, 3)
    const graphics = this.add.graphics().setDepth(1)
    graphics.lineStyle(34, this.theme.dark ? 0x000000 : 0xffffff, 0.35)
    graphics.strokePoints(points, false)
    graphics.lineStyle(26, Phaser.Display.Color.HexStringToColor(this.theme.track).color, 0.55)
    graphics.strokePoints(points, false)
    graphics.lineStyle(2, 0xffffff, 0.35)
    graphics.strokePoints(points, false)

    const hole = path.samples[path.samples.length - 1]
    this.hole = this.add.container(hole.x, hole.y).setDepth(2)
    const ring = this.add.circle(0, 0, 26, 0x0b1020, 0.95)
    ring.setStrokeStyle(4, 0xf43f5e, 0.9)
    const glow = this.add.circle(0, 0, 34, 0xf43f5e, 0.22)
    this.hole.add([glow, ring])
    this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.05, duration: 1200, yoyo: true, repeat: -1 })
  }

  drawChrome() {
    const theme = this.theme
    iconButton(this, 44, 46, '‹', () => {
      sfx.click()
      fade(this, this.mode === 'journey' ? 'levels' : 'menu')
    }, theme, 46)

    text(this, W / 2, 34, this.levelLabel, 19, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 62, `${this.level.marbles.length} marbles · ${this.level.colors.length} colours`, 13, theme.subtext).setOrigin(0.5)

    this.scoreText = text(this, 28, 96, '0', 18, theme.text, { fontStyle: 'bold' }).setOrigin(0, 0.5)
    this.comboText = text(this, W / 2, 96, '', 15, theme.subtext, { fontStyle: 'bold' }).setOrigin(0.5)
    this.remainingText = text(this, W - 28, 96, '', 13, theme.subtext).setOrigin(1, 0.5)

    const bar = this.add.graphics()
    bar.fillStyle(theme.dark ? 0xffffff : theme.accent, 0.14)
    bar.fillRoundedRect(28, 114, W - 56, 8, 4)
    this.progressBar = this.add.graphics()

    this.powerButtons = []
    const labels = [
      { key: 'slow', label: 'Slow' },
      { key: 'reverse', label: 'Reverse' },
      { key: 'rainbow', label: 'Rainbow' },
    ]
    labels.forEach((entry, index) => {
      const x = 116 + index * 204
      const b = button(this, x, 886, entry.label, () => this.usePowerup(entry.key), {
        width: 176,
        height: 46,
        size: 15,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      })
      this.powerButtons.push({ ...entry, b })
    })
  }

  buildLauncher() {
    this.launcher = this.add.container(LAUNCHER.x, LAUNCHER.y).setDepth(20)
    const base = this.add.circle(0, 0, 34, this.theme.dark ? 0x1e1b4b : 0xffffff, 0.92)
    base.setStrokeStyle(4, this.theme.accent, 0.85)
    this.launcherBubble = drawMarble(this, MARBLE_HEX[this.current] ?? '#34d399', 16)
    this.nextBubble = drawMarble(this, MARBLE_HEX[this.following] ?? '#34d399', 10)
    this.nextBubble.setPosition(58, 4)
    this.launcher.add([base, this.launcherBubble, this.nextBubble])

    this.add
      .text(LAUNCHER.x + 58, LAUNCHER.y + 26, 'next', { fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: this.theme.subtext })
      .setOrigin(0.5)
      .setDepth(20)
  }

  bindInput() {
    this.input.on('pointermove', (pointer) => this.aimAt(pointer))
    this.input.on('pointerdown', (pointer) => {
      // The bottom strip is the power-up bar and the top strip is chrome; a
      // tap there must never fire.
      if (pointer.y > 780 || pointer.y < 122) return
      this.aimAt(pointer)
      this.firing = true
    })
    this.input.on('pointerup', () => {
      if (!this.firing) return
      this.firing = false
      this.shoot()
    })
    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.on('keydown-SPACE', () => this.shoot())
      keyboard.on('keydown-R', () => this.restart())
      keyboard.on('keydown-ESC', () => this.togglePause())
      keyboard.on('keydown-S', () => this.usePowerup('slow'))
      keyboard.on('keydown-X', () => this.usePowerup('reverse'))
      keyboard.on('keydown-C', () => this.usePowerup('rainbow'))
    }
  }

  aimAt(pointer) {
    const dx = pointer.x - LAUNCHER.x
    const dy = pointer.y - LAUNCHER.y
    let angle = Math.atan2(dy, dx)
    if (angle > -0.15) angle = -0.15
    if (angle < -Math.PI + 0.15) angle = -Math.PI + 0.15
    this.aimAngle = angle
  }

  // ---------- chain rendering ---------------------------------------------

  createMarbleSprite(marble) {
    const color = MARBLE_HEX[marble.color] ?? '#94a3b8'
    const container = drawMarble(this, color, MARBLE_RADIUS).setDepth(10)
    if (marble.special === 'rainbow') {
      container.add(this.add.circle(0, 0, MARBLE_RADIUS + 4).setStrokeStyle(3, 0xffffff, 0.9))
      container.add(this.add.circle(0, 0, MARBLE_RADIUS - 5, 0xffffff, 0.85))
      container.add(this.add.text(0, 0, '✦', { fontSize: '14px', color: '#7c3aed' }).setOrigin(0.5))
    }
    if (marble.special === 'bomb') {
      container.add(this.add.text(0, 0, '✹', { fontSize: '13px', color: '#0f172a' }).setOrigin(0.5))
    }
    if (marble.special === 'frozen') {
      container.add(this.add.circle(0, 0, MARBLE_RADIUS + 2, 0xdbeafe, 0.5))
      container.add(this.add.text(0, 0, '❄', { fontSize: '13px', color: '#1e3a8a' }).setOrigin(0.5))
    }
    return { container, marble }
  }

  syncChain() {
    const views = marbleViews(this.chain, this.level.path)
    const seen = new Set()
    for (const view of views) {
      const id = view.marble.id
      seen.add(id)
      let sprite = this.marbleSprites.get(id)
      if (!sprite) {
        sprite = this.createMarbleSprite(view.marble)
        this.marbleSprites.set(id, sprite)
      }
      sprite.container.setVisible(view.visible)
      sprite.container.setPosition(view.x, view.y)
    }
    for (const [id, sprite] of this.marbleSprites) {
      if (!seen.has(id) && !this.popping.has(id)) {
        sprite.container.destroy()
        this.marbleSprites.delete(id)
      }
    }
  }

  popSprite(marble, delay = 0) {
    const sprite = this.marbleSprites.get(marble.id)
    if (!sprite) return
    this.popping.add(marble.id)
    const container = sprite.container
    const burst = this.add.circle(container.x, container.y, 8, 0xffffff, 0.8).setDepth(18)
    this.tweens.add({ targets: burst, scale: 2.4, alpha: 0, duration: 240, delay, onComplete: () => burst.destroy() })
    this.tweens.add({
      targets: container,
      scale: 0.1,
      alpha: 0,
      duration: 170,
      delay,
      ease: 'Back.In',
      onComplete: () => {
        container.destroy()
        this.marbleSprites.delete(marble.id)
        this.popping.delete(marble.id)
      },
    })
  }

  // ---------- shooting -----------------------------------------------------

  nextColour() {
    const colors = this.level.colors
    return colors[Math.floor(this.queueRng() * colors.length)]
  }

  shoot(now = this.time.now) {
    if (this.over || this.paused) return
    if (now - this.lastShotAt < FIRE_COOLDOWN * 1000) return
    this.lastShotAt = now
    this.shotsFired += 1

    const def = this.rainbowShot ? { color: this.current, special: 'rainbow' } : { color: this.current }
    this.rainbowShot = false
    sfx.fire()

    const bubble = drawMarble(this, MARBLE_HEX[def.color] ?? '#94a3b8', 10).setDepth(25)
    bubble.setPosition(LAUNCHER.x, LAUNCHER.y)
    const vx = Math.cos(this.aimAngle) * SHOT_SPEED
    const vy = Math.sin(this.aimAngle) * SHOT_SPEED
    this.projectiles.push({ bubble, vx, vy, def, life: 2.2 })

    this.current = this.following
    this.following = this.nextColour()
    this.launcherBubble.destroy()
    this.launcherBubble = drawMarble(this, MARBLE_HEX[this.current] ?? '#34d399', 16)
    this.launcher.add(this.launcherBubble)
    this.nextBubble.destroy()
    this.nextBubble = drawMarble(this, MARBLE_HEX[this.following] ?? '#34d399', 10)
    this.nextBubble.setPosition(58, 4)
    this.launcher.add(this.nextBubble)
  }

  updateAimPreview() {
    this.preview.clear()
    if (this.over || this.paused) return
    const length = 220
    const startX = LAUNCHER.x + Math.cos(this.aimAngle) * 40
    const startY = LAUNCHER.y + Math.sin(this.aimAngle) * 40
    this.preview.lineStyle(2, 0xffffff, 0.35)
    this.preview.beginPath()
    this.preview.moveTo(startX, startY)
    this.preview.lineTo(startX + Math.cos(this.aimAngle) * length, startY + Math.sin(this.aimAngle) * length)
    this.preview.strokePath()
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i -= 1) {
      const shot = this.projectiles[i]
      shot.life -= dt
      shot.bubble.x += shot.vx * dt
      shot.bubble.y += shot.vy * dt

      const hit = this.findHit(shot.bubble)
      if (hit) {
        this.resolveHit(hit, shot)
        shot.bubble.destroy()
        this.projectiles.splice(i, 1)
        continue
      }
      if (shot.life <= 0 || shot.bubble.y < -40 || shot.bubble.x < -40 || shot.bubble.x > W + 40) {
        shot.bubble.destroy()
        this.projectiles.splice(i, 1)
      }
    }
  }

  findHit(point) {
    let best = null
    this.chain.marbles.forEach((marble, index) => {
      if (marble.s < 0) return
      const view = pointAt(this.level.path, Math.min(marble.s, this.level.path.length))
      const gap = Math.hypot(view.x - point.x, view.y - point.y)
      if (gap <= MARBLE_RADIUS * 1.7 && (!best || gap < best.gap)) best = { index, gap, marble, x: view.x, y: view.y }
    })
    return best
  }

  resolveHit(hit, shot) {
    this.shotsHit += 1
    const marble = this.chain.marbles[hit.index]
    if (marble.special === 'frozen' && !marble.thawed) {
      this.chain = thawMarble(this.chain, hit.index)
      sfx.thaw()
      this.score += 15
      this.updateHud()
      return
    }

    const insertion = findInsertion(this.chain, this.level.path, { x: shot.bubble.x, y: shot.bubble.y })
    if (!insertion) return

    const colour = shot.def.special === 'rainbow' ? marble.color : shot.def.color
    const def = shot.def.special === 'rainbow' ? { color: colour, special: 'rainbow' } : { color: colour }
    this.chain = insertMarble(this.chain, insertion.index, def).chain
    sfx.insert()

    const resolved = resolveMatches(this.chain)
    this.chain = resolved.chain
    if (resolved.popped > 0) {
      this.runPopped += resolved.popped
      this.runMatches += 1
      this.bestCombo = Math.max(this.bestCombo, resolved.combo)
      this.score += resolved.score
      resolved.steps.forEach((step, stepIndex) => {
        step.removed.forEach((removedMarble) => this.popSprite(removedMarble, stepIndex * 90))
      })
      sfx.pop(resolved.combo)
      if (resolved.combo > 1) sfx.combo(resolved.combo)
      this.showCombo(resolved.combo, resolved.score)
    }
    this.syncChain()
    this.updateHud()

    if (isCleared(this.chain)) this.win()
  }

  showCombo(combo, points) {
    if (combo < 2) return
    const label = text(this, W / 2, 500, `COMBO ×${combo}  +${points}`, 26, '#ffffff', {
      fontStyle: 'bold',
      stroke: '#7c3aed',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(40)
    this.tweens.add({
      targets: label,
      y: 452,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    })
  }

  // ---------- power-ups ----------------------------------------------------

  usePowerup(key) {
    if (this.over || this.paused) return
    if (this.powerups[key] <= 0) return
    this.powerups[key] -= 1
    sfx.power()
    if (key === 'slow') this.slowUntil = this.time.now + 8000
    if (key === 'reverse') {
      this.reverseUntil = this.time.now + 4000
      sfx.reverse()
    }
    if (key === 'rainbow') this.rainbowShot = true
    this.updateHud()
  }

  // ---------- loop ---------------------------------------------------------

  update(time, delta) {
    if (this.over || this.paused) {
      this.preview?.clear()
      return
    }
    const dt = Math.min(0.05, delta / 1000)
    const slow = time < this.slowUntil ? 0.45 : 1
    const reverse = time < this.reverseUntil ? -1 : 1
    advance(this.chain, this.level.speed * slow * reverse * dt)

    this.syncChain()
    this.updateProjectiles(dt)
    this.updateAimPreview()
    this.updateProgress()

    if (hasReachedEnd(this.chain, this.level.path)) this.reachEnd()
  }

  updateProgress() {
    const progress = chainProgress(this.chain, this.level.path)
    this.progressBar.clear()
    this.progressBar.fillStyle(progress > 0.8 ? 0xef4444 : this.theme.accent, 0.9)
    this.progressBar.fillRoundedRect(28, 114, Math.max(2, (W - 56) * progress), 8, 4)

    const remaining = this.chain.marbles.length
    this.remainingText.setText(`${remaining} left`)
  }

  updateHud() {
    this.scoreText?.setText(String(this.score))
    this.comboText?.setText(this.bestCombo > 1 ? `best combo ×${this.bestCombo}` : '')
    this.powerButtons?.forEach(({ key, b }) => {
      const count = this.powerups[key]
      const labels = { slow: 'Slow', reverse: 'Reverse', rainbow: 'Rainbow' }
      b.setCaption(`${labels[key]} ×${count}`)
      b.setAlpha(count > 0 ? 1 : 0.45)
    })
    this.updateProgress()
  }

  // ---------- outcomes -----------------------------------------------------

  reachEnd() {
    if (this.mode === 'zen') {
      this.restartWave()
      return
    }
    this.lose()
  }

  restartWave() {
    this.chain = createChain(this.level.marbles, { spacing: this.level.spacing, startS: this.level.startS })
    for (const sprite of this.marbleSprites.values()) sprite.container.destroy()
    this.marbleSprites.clear()
    this.syncChain()
    this.updateHud()
  }

  accuracy() {
    return this.shotsFired === 0 ? 0 : this.shotsHit / this.shotsFired
  }

  finishRecord(cleared, stars) {
    const before = { achievements: [...data.achievements] }
    record({
      mode: this.mode,
      levelId: this.mode === 'daily' ? this.level.id : this.mode === 'journey' ? this.level.id : 0,
      cleared,
      stars,
      score: this.score,
      combo: this.bestCombo,
      popped: this.runPopped,
      matches: this.runMatches,
      accuracy: this.accuracy(),
      rainbow: this.level.marbles.some((def) => def.special === 'rainbow'),
      stage: this.stage,
      wave: this.wave,
    })
    return newlyUnlocked(before, data)
  }

  win() {
    if (this.over) return
    this.over = true
    const accuracy = this.accuracy()
    const stars = starsFor({ accuracy, cleared: true, progress: 0 })
    const gained = this.finishRecord(true, stars)
    sfx.win()
    this.showWin(stars, gained, accuracy)
  }

  lose() {
    if (this.over) return
    this.over = true
    this.finishRecord(false, 0)
    sfx.lose()
    this.showLose()
  }

  overlay() {
    const layer = this.add.container(0, 0).setDepth(60)
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b1020, 0.6).setInteractive())
    return layer
  }

  showWin(stars, gained, accuracy) {
    const theme = this.theme
    const layer = this.overlay()
    layer.add(panel(this, W / 2, 490, 520, 480, theme, { alpha: 0.98 }))
    layer.add(text(this, W / 2, 300, 'Spiral cleared!', 34, theme.text, { fontStyle: 'bold' }).setOrigin(0.5))
    for (let i = 0; i < 3; i += 1) {
      const star = text(this, W / 2 - 60 + i * 60, 368, i < stars ? '★' : '☆', 44, i < stars ? '#f59e0b' : theme.subtext, {
        alpha: i < stars ? 1 : 0.45,
      }).setOrigin(0.5)
      layer.add(star)
    }
    layer.add(
      text(this, W / 2, 428, `${this.score} points · ${Math.round(accuracy * 100)}% accuracy · combo ×${this.bestCombo}`, 16, theme.subtext).setOrigin(0.5),
    )
    if (gained.length) {
      layer.add(
        text(this, W / 2, 460, `New: ${gained.map((a) => a.name).join(', ')}`, 14, theme.subtext, {
          wordWrap: { width: 450 },
          align: 'center',
        }).setOrigin(0.5),
      )
    }

    const next = () => {
      if (this.mode === 'journey' && this.level.id < TOTAL_LEVELS) {
        this.scene.restart({ mode: 'journey', level: this.level.id + 1 })
      } else if (this.mode === 'classic') {
        this.scene.restart({ mode: 'classic', stage: this.stage + 1, score: this.score })
      } else if (this.mode === 'endless') {
        this.scene.restart({ mode: 'endless', wave: this.wave + 1, score: this.score })
      } else if (this.mode === 'zen') {
        this.scene.restart({ mode: 'zen', seed: Date.now(), score: this.score })
      } else {
        fade(this, 'levels')
      }
    }

    layer.add(
      button(this, W / 2, 540, this.mode === 'daily' ? 'Journey' : 'Next', next, {
        width: 380,
        height: 56,
        fill: theme.accent,
        textColor: theme.accentText,
        theme,
      }),
    )
    layer.add(
      button(this, W / 2 - 100, 612, 'Replay', () => this.scene.restart(this.scene.settings.data), {
        width: 180,
        height: 50,
        size: 16,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
    layer.add(
      button(this, W / 2 + 100, 612, 'Journey', () => fade(this, 'levels'), {
        width: 180,
        height: 50,
        size: 16,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
  }

  showLose() {
    const theme = this.theme
    const layer = this.overlay()
    layer.add(panel(this, W / 2, 480, 500, 330, theme, { alpha: 0.98 }))
    layer.add(text(this, W / 2, 380, 'The spiral got through', 28, theme.text, { fontStyle: 'bold' }).setOrigin(0.5))
    layer.add(text(this, W / 2, 430, `${this.score} points · ${this.chain.marbles.length} marbles left`, 16, theme.subtext).setOrigin(0.5))
    layer.add(
      button(this, W / 2, 500, 'Try again', () => this.scene.restart(this.scene.settings.data), {
        width: 360,
        height: 56,
        fill: theme.accent,
        textColor: theme.accentText,
        theme,
      }),
    )
    layer.add(
      button(this, W / 2, 572, 'Menu', () => fade(this, 'menu'), {
        width: 360,
        height: 50,
        size: 17,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
  }

  restart() {
    this.scene.restart(this.scene.settings.data)
  }

  togglePause() {
    if (this.over) return
    if (this.paused) {
      this.paused.destroy(true)
      this.paused = null
      return
    }
    const theme = this.theme
    const layer = this.add.container(0, 0).setDepth(65)
    layer.add(this.add.rectangle(W / 2, H / 2, W, H, 0x0b1020, 0.55).setInteractive())
    layer.add(panel(this, W / 2, H / 2, 420, 300, theme, { alpha: 0.98 }))
    layer.add(text(this, W / 2, H / 2 - 92, 'Paused', 28, theme.text, { fontStyle: 'bold' }).setOrigin(0.5))
    layer.add(
      button(this, W / 2, H / 2 - 20, 'Resume', () => this.togglePause(), {
        width: 300,
        height: 54,
        fill: theme.accent,
        textColor: theme.accentText,
        theme,
      }),
    )
    layer.add(
      button(this, W / 2, H / 2 + 48, 'Restart', () => {
        layer.destroy(true)
        this.paused = null
        this.restart()
      }, { width: 300, height: 54, fill: theme.dark ? 0x312e81 : 0xffffff, textColor: theme.dark ? '#e0e7ff' : theme.text, theme }),
    )
    layer.add(
      button(this, W / 2, H / 2 + 116, 'Leave', () => fade(this, this.mode === 'journey' ? 'levels' : 'menu'), {
        width: 300,
        height: 54,
        fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text,
        theme,
      }),
    )
    this.paused = layer
  }
}
