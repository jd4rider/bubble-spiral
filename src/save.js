// localStorage wrapper around the pure progression rules. The arcade client
// mirrors this key into the player's account, so it stays plain JSON.

import { defaultSave, normalizeSave, recordResult } from './progress.js'

export const SAVE_KEY = 'bubble-spiral-save-v1'

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? normalizeSave(JSON.parse(raw)) : defaultSave()
  } catch {
    return defaultSave()
  }
}

export const data = loadSave()

export function persist() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    // Private mode or file:// without storage: play continues, saving does not.
  }
  return data
}

export function commit(next) {
  Object.assign(data, next)
  return persist()
}

export function record(result) {
  return commit(recordResult(data, result))
}

export function setSetting(key, value) {
  data.settings = { ...data.settings, [key]: value }
  return persist()
}
