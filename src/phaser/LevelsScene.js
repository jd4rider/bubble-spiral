import Phaser from 'phaser'
import { W, H, background, button, text, fade, themeOf, iconButton, starString } from './common.js'
import { data } from '../save.js'
import { CHAPTERS, TOTAL_LEVELS, chapterStart, journeyLevel } from '../levels.js'
import { isLevelUnlocked } from '../progress.js'
import { sfx } from '../sound.js'

export default class LevelsScene extends Phaser.Scene {
  constructor() {
    super('levels')
  }

  init(payload = {}) {
    const startChapter = payload.chapter ?? Math.max(1, Math.ceil(data.unlocked / 12))
    this.chapterIndex = Math.min(CHAPTERS.length - 1, Math.max(0, startChapter - 1))
  }

  create() {
    this.input.enabled = true
    this.theme = themeOf(data.settings.theme)
    background(this, this.theme, { motes: !data.settings.reducedMotion })
    this.cameras.main.fadeIn(200, 8, 8, 20)
    iconButton(this, 46, 46, '‹', () => fade(this, 'menu'), this.theme, 48)
    text(this, W / 2, 42, 'Journey', 26, this.theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    text(this, W / 2, 72, `${TOTAL_LEVELS} spirals · eight chapters`, 15, this.theme.subtext).setOrigin(0.5)
    this.drawChapter()
  }

  drawChapter() {
    const chapter = CHAPTERS[this.chapterIndex]
    const theme = this.theme
    if (this.layer) this.layer.destroy()
    this.layer = this.add.container(0, 0)

    iconButton(this, 58, 150, '‹', () => this.step(-1), theme, 44)
    iconButton(this, W - 58, 150, '›', () => this.step(1), theme, 44)
    this.layer.add(text(this, W / 2, 134, `Chapter ${chapter.id} · ${chapter.name}`, 20, theme.text, { fontStyle: 'bold' }).setOrigin(0.5))
    this.layer.add(text(this, W / 2, 166, chapter.tagline, 14, theme.subtext).setOrigin(0.5))

    const start = chapterStart(chapter.id)
    const cols = 4
    const cellW = 132
    const cellH = 104
    const originX = W / 2 - (cellW * (cols - 1)) / 2
    const originY = 240

    for (let i = 0; i < chapter.count; i += 1) {
      const number = start + i
      const unlocked = isLevelUnlocked(data, number)
      const stars = data.stars[String(number)] ?? 0
      const x = originX + (i % cols) * cellW
      const y = originY + Math.floor(i / cols) * cellH
      const box = this.add.container(x, y)
      const g = this.add.graphics()
      g.fillStyle(theme.shadow, 0.16)
      g.fillRoundedRect(-52, -35, 104, 80, 18)
      g.fillStyle(unlocked ? (theme.dark ? 0x4338ca : 0xffffff) : theme.dark ? 0x1e1b4b : 0xe2e8f0, unlocked ? 0.94 : 0.5)
      g.fillRoundedRect(-52, -40, 104, 80, 18)
      if (unlocked) {
        g.lineStyle(2, theme.accent, 0.28)
        g.strokeRoundedRect(-52, -40, 104, 80, 18)
      }
      box.add(g)
      box.add(text(this, 0, -9, unlocked ? String(number) : '🔒', unlocked ? 25 : 21, unlocked ? theme.text : theme.subtext, { fontStyle: 'bold' }).setOrigin(0.5))
      box.add(text(this, 0, 18, starString(stars), 13, theme.subtext, { alpha: unlocked ? 1 : 0.6 }).setOrigin(0.5))
      if (unlocked) {
        box.setSize(104, 80).setInteractive({ useHandCursor: true })
        box.on('pointerdown', () => {
          sfx.click()
          fade(this, 'game', { mode: 'journey', level: number })
        })
      } else {
        box.setAlpha(0.72)
      }
      this.layer.add(box)
    }

    const level = journeyLevel(Math.min(data.unlocked, TOTAL_LEVELS))
    this.layer.add(
      text(this, W / 2, H - 156, `${chapter.count} boards · ${level.marbles.length} marbles`, 14, theme.subtext, { alpha: 0.85 }).setOrigin(0.5),
    )
    this.layer.add(
      button(this, W / 2, H - 96, `Play ${level.chapterName} ${level.title}`, () => {
        fade(this, 'game', { mode: 'journey', level: Math.min(data.unlocked, TOTAL_LEVELS) })
      }, { width: 430, height: 56, size: 18, fill: theme.accent, textColor: theme.accentText, theme, icon: '▶' }),
    )
  }

  step(direction) {
    const next = this.chapterIndex + direction
    if (next < 0 || next >= CHAPTERS.length) return
    sfx.click()
    this.chapterIndex = next
    this.drawChapter()
  }
}
