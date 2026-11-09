import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ReaderSettings } from '../types'

const STORAGE_KEY = 'openbook-settings-v1'

const DEFAULTS: ReaderSettings = {
  theme: 'light',
  fontSize: 18,
  fontFamily: 'Georgia, "Times New Roman", serif',
  lineHeight: 1.6,
  textAlign: 'left',
  flow: 'paginated',
  hyphenate: true,
  justify: false,
  maxInlineSize: 0,
  animated: true,
}

function load(): ReaderSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<ReaderSettings>
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<ReaderSettings>(load())

  watch(
    settings,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* storage full / private mode — ignore */
      }
    },
    { deep: true },
  )

  function reset() {
    settings.value = { ...DEFAULTS }
  }

  return { settings, reset }
})
