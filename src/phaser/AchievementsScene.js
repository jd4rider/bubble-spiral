import Phaser from 'phaser'
import { W, background, text, fade, themeOf, iconButton, panel } from './common.js'
import { data } from '../save.js'
import { ACHIEVEMENTS } from '../progress.js'

export default class AchievementsScene extends Phaser.Scene {
  constructor() {
    super('achievements')
  }

  create() {
    const theme = themeOf(data.settings.theme)
    background(this, theme, { motes: !data.settings.reducedMotion })
    iconButton(this, 44, 46, '‹', () => fade(this, 'menu'), theme, 46)
    text(this, W / 2, 40, 'Achievements', 26, theme.text, { fontStyle: 'bold' }).setOrigin(0.5)
    const earned = ACHIEVEMENTS.filter((a) => data.achievements.includes(a.id)).length
    text(this, W / 2, 74, `${earned} of ${ACHIEVEMENTS.length} earned`, 15, theme.subtext).setOrigin(0.5)

    ACHIEVEMENTS.forEach((achievement, index) => {
      const y = 134 + index * 74
      const has = data.achievements.includes(achievement.id)
      panel(this, W / 2, y, 552, 62, theme, { alpha: has ? 0.92 : 0.5, radius: 16 })
      const badge = this.add.graphics()
      badge.fillStyle(has ? theme.accent : 0x94a3b8, has ? 0.95 : 0.35)
      badge.fillCircle(84, y, 18)
      text(this, 84, y, has ? '★' : '·', 17, '#ffffff').setOrigin(0.5)
      text(this, 114, y - 10, achievement.name, 16, theme.text, { fontStyle: 'bold' }).setOrigin(0, 0.5)
      text(this, 114, y + 12, achievement.description, 12, theme.subtext).setOrigin(0, 0.5)
      if (has) text(this, W - 52, y, '✓', 19, theme.accent, { fontStyle: 'bold' }).setOrigin(0.5)
      void badge
      void Phaser
    })
  }
}
