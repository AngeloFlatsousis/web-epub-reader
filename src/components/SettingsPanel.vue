<script setup lang="ts">
import { computed } from 'vue'
import { FONT_FAMILIES, THEMES } from '../lib/epub'
import { useSettingsStore } from '../stores/settings'
import type { ThemeName } from '../types'

const settings = useSettingsStore()
const s = computed(() => settings.settings)

const themeEntries = computed(() => Object.entries(THEMES) as [ThemeName, (typeof THEMES)[ThemeName]][])
</script>

<template>
  <div class="space-y-5">
    <section aria-labelledby="settings-theme">
      <h3 id="settings-theme" class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Theme</h3>
      <div class="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Reading theme">
        <button
          v-for="[name, def] in themeEntries"
          :key="name"
          type="button"
          role="radio"
          :aria-checked="s.theme === name"
          class="flex flex-col items-center gap-1.5 rounded-xl border p-2 transition focus-visible:ring-2 focus-visible:ring-indigo-500"
          :class="s.theme === name ? 'border-indigo-500 ring-2 ring-indigo-500/30' : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600'"
          @click="s.theme = name"
        >
          <span class="h-8 w-full rounded-md border" :style="{ background: def.bg, borderColor: def.border }" aria-hidden="true">
            <span class="mx-auto mt-2 block h-1 w-3/4 rounded-full" :style="{ background: def.fg }" />
            <span class="mx-auto mt-1 block h-1 w-1/2 rounded-full opacity-60" :style="{ background: def.fg }" />
          </span>
          <span class="text-[11px] font-medium capitalize text-zinc-700 dark:text-zinc-200">{{ name }}</span>
        </button>
      </div>
    </section>

    <section aria-labelledby="settings-flow">
      <h3 id="settings-flow" class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Layout</h3>
      <div class="mt-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Reading layout">
        <button
          type="button"
          role="radio"
          :aria-checked="s.flow === 'paginated'"
          class="rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-500"
          :class="s.flow === 'paginated' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'"
          @click="s.flow = 'paginated'"
        >
          Paginated
        </button>
        <button
          type="button"
          role="radio"
          :aria-checked="s.flow === 'scrolled'"
          class="rounded-xl border px-3 py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-indigo-500"
          :class="s.flow === 'scrolled' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' : 'border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800'"
          @click="s.flow = 'scrolled'"
        >
          Scrolled
        </button>
      </div>
      <label class="mt-3 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input v-model="s.animated" type="checkbox" name="animated" class="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
        Page-turn animation
      </label>
    </section>

    <section aria-labelledby="settings-type">
      <h3 id="settings-type" class="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Typography</h3>
      <div class="mt-3 space-y-4">
        <div>
          <label for="font-size" class="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
            <span>Font size</span>
            <span class="tabular-nums text-xs text-zinc-500">{{ s.fontSize }}px</span>
          </label>
          <input id="font-size" v-model.number="s.fontSize" type="range" min="14" max="26" step="1" name="font-size" class="mt-1 w-full" />
        </div>
        <div>
          <label for="font-family" class="text-sm text-zinc-700 dark:text-zinc-200">Font family</label>
          <select
            id="font-family"
            v-model="s.fontFamily"
            name="font-family"
            class="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option v-for="f in FONT_FAMILIES" :key="f.value" :value="f.value">{{ f.label }}</option>
          </select>
        </div>
        <div>
          <label for="line-height" class="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
            <span>Line height</span>
            <span class="tabular-nums text-xs text-zinc-500">{{ s.lineHeight.toFixed(2) }}</span>
          </label>
          <input id="line-height" v-model.number="s.lineHeight" type="range" min="1.2" max="2" step="0.05" name="line-height" class="mt-1 w-full" />
        </div>
        <div>
          <label for="text-align" class="text-sm text-zinc-700 dark:text-zinc-200">Alignment</label>
          <select
            id="text-align"
            v-model="s.textAlign"
            name="text-align"
            class="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="left">Left</option>
            <option value="justify">Justified</option>
            <option value="center">Center</option>
          </select>
        </div>
        <div>
          <label for="max-inline" class="flex items-center justify-between text-sm text-zinc-700 dark:text-zinc-200">
            <span>Column width</span>
            <span class="tabular-nums text-xs text-zinc-500">{{ s.maxInlineSize === 0 ? 'Auto' : `${s.maxInlineSize}px` }}</span>
          </label>
          <input id="max-inline" v-model.number="s.maxInlineSize" type="range" min="0" max="900" step="20" name="max-inline" class="mt-1 w-full" />
          <p class="mt-1 text-xs text-zinc-400">0 = auto. Narrower columns suit long-form reading.</p>
        </div>
        <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input v-model="s.hyphenate" type="checkbox" name="hyphenate" class="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
          Hyphenation
        </label>
        <label class="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input v-model="s.justify" type="checkbox" name="justify" class="h-4 w-4 rounded border-zinc-300 accent-indigo-600" />
          Justify text
        </label>
      </div>
    </section>

    <button
      type="button"
      class="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      @click="settings.reset()"
    >
      Reset to defaults
    </button>
  </div>
</template>
