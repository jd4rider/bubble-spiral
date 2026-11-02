import Phaser from 'phaser'
import { W, H, background, button, text, fade, themeOf, THEME_KEYS, starString } from './common.js'
import { data, setSetting } from '../save.js'
import { TOTAL_LEVELS, journeyLevel } from '../levels.js'
import { totalStars } from '../progress.js'
import { sfx } from '../sound.js'

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu')
  }

  create() {
    this.input.enabled = true
    const theme = themeOf(data.settings.theme)
    background(this, theme, { motes: !data.settings.reducedMotion })
    this.cameras.main.fadeIn(240, 8, 8, 20)

    // A small spiral of marbles behind the wordmark.
    for (let i = 0; i < 16; i += 1) {
      const t = i / 15
      const angle = t * Math.PI * 3.4
      const radius = 18 + t * 104
      const dot = this.add.circle(
        W / 2 + Math.cos(angle) * radius,
        140 + Math.sin(angle) * radius * 0.5,
        5 + t * 4,
        Phaser.Display.Color.HexStringToColor(
          ['#34d399', '#fb7185', '#60a5fa', '#fbbf24', '#a78bfa', '#f472b6'][i % 6],
        ).color,
        0.7,
      )
      dot.setDepth(-1)
      this.tweens.add({ targets: dot, y: dot.y - 4, duration: 1600 + i * 90, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    }

    text(this, W / 2, 140, 'BUBBLE SPIRAL', 48, theme.text, {
      fontStyle: 'bold',
      stroke: theme.dark ? '#0b1020' : '#ffffff',
      strokeThickness: 7,
    }).setOrigin(0.5)
    text(this, W / 2, 194, 'Aim, fire, and pop the chain before it reaches the hole.', 17, theme.subtext, {
      align: 'center',
      wordWrap: { width: 520 },
    }).setOrigin(0.5)

    const next = Math.min(data.unlocked, TOTAL_LEVELS)
    const resume = journeyLevel(next)
    button(this, W / 2, 274, `${next > 1 ? 'Continue' : 'Start'} · ${resume.chapterName} ${resume.title}`, () => {
      fade(this, 'game', { mode: 'journey', level: next })
    }, { width: 470, height: 62, size: 20, fill: theme.accent, textColor: theme.accentText, theme, icon: '▶' })

    const row = (y, left, right) => {
      button(this, W / 2 - 108, y, left.label, left.action, {
        width: 204, height: 54, size: 17, fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text, theme, icon: left.icon,
      })
      button(this, W / 2 + 108, y, right.label, right.action, {
        width: 204, height: 54, size: 17, fill: theme.dark ? 0x312e81 : 0xffffff,
        textColor: theme.dark ? '#e0e7ff' : theme.text, theme, icon: right.icon,
      })
    }

    row(356, { label: 'Journey', icon: '🗺', action: () => fade(this, 'levels') }, { label: 'Daily', icon: '📅', action: () => fade(this, 'game', { mode: 'daily' }) })
    row(424, { label: 'Endless', icon: '∞', action: () => fade(this, 'game', { mode: 'endless', wave: 1 }) }, { label: 'Zen', icon: '🌿', action: () => fade(this, 'game', { mode: 'zen' }) })
    row(492, { label: 'Classic', icon: '◈', action: () => fade(this, 'game', { mode: 'classic', stage: Math.max(1, data.classicBest + 1) }) }, { label: 'Achievements', icon: '🏅', action: () => fade(this, 'achievements') })
    button(this, W / 2, 560, 'Settings', () => fade(this, 'settings'), {
      width: 204, height: 54, size: 17, fill: theme.dark ? 0x312e81 : 0xffffff,
      textColor: theme.dark ? '#e0e7ff' : theme.text, theme, icon: '⚙',
    })

    text(this, W / 2, 624, `${Object.keys(data.stars).length} of ${TOTAL_LEVELS} levels · ${totalStars(data)}★ · best ${data.bestScore}`, 15, theme.subtext).setOrigin(0.5)
    const today = new Date().toISOString().slice(0, 10)
    const dailyStars = data.daily[today]?.stars ?? 0
    text(this, W / 2, 650, dailyStars ? `Today's spiral: ${starString(dailyStars)}` : "Today's spiral is waiting.", 14, theme.subtext, { alpha: 0.85 }).setOrigin(0.5)

    button(this, 90, 730, data.settings.sound ? 'Sound on' : 'Muted', () => {
      setSetting('sound', !data.settings.sound)
      this.scene.restart()
    }, { width: 150, height: 42, size: 14, fill: theme.dark ? 0x312e81 : 0xffffff, textColor: theme.dark ? '#e0e7ff' : theme.text, theme })

    const arcade = text(this, W / 2, 730, 'littlejoyarcade.site →', 15, theme.subtext, { fontStyle: 'bold' }).setOrigin(0.5)
    arcade.setInteractive({ useHandCursor: true })
    arcade.on('pointerdown', () => {
      sfx.click()
      window.open('https://littlejoyarcade.site', '_blank', 'noopener')
    })

    button(this, W - 90, 730, `${THEME_KEYS.length} themes`, () => {
      const index = THEME_KEYS.indexOf(data.settings.theme)
      setSetting('theme', THEME_KEYS[(index + 1) % THEME_KEYS.length])
      this.scene.restart()
    }, { width: 150, height: 42, size: 14, fill: theme.dark ? 0x312e81 : 0xffffff, textColor: theme.dark ? '#e0e7ff' : theme.text, theme })

    text(this, W / 2, H - 40, 'Drag to aim · release to fire · Space / R / Esc', 13, theme.subtext, { alpha: 0.7 }).setOrigin(0.5)
    this.input.keyboard?.on('keydown-ENTER', () => fade(this, 'game', { mode: 'journey', level: next }))
  }
}
