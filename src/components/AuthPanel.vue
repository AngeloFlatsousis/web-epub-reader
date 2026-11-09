<script setup lang="ts">
import { ref } from 'vue'
import { useSyncStore } from '../stores/sync'

const sync = useSyncStore()
const email = ref('')
const password = ref('')
const mode = ref<'signin' | 'signup'>('signin')

async function onSubmit(e: SubmitEvent) {
  e.preventDefault()
  sync.clearError()
  try {
    if (mode.value === 'signup') await sync.signUp(email.value, password.value)
    else await sync.signIn(email.value, password.value)
  } catch {
    /* error surface lives in sync.error */
  }
}
</script>

<template>
  <section
    v-if="!sync.configured"
    class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
  >
    <p>Cloud sync is not configured.</p>
    <p class="mt-1 text-xs text-amber-600 dark:text-amber-400">
      Add <code class="bg-amber-200/60 dark:bg-amber-900 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and
      <code class="bg-amber-200/60 dark:bg-amber-900 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>
      to <code>.env</code> (see <code>.env.example</code>), then redeploy.
    </p>
  </section>

  <form v-else-if="!sync.signedIn" @submit="onSubmit" class="flex flex-col gap-3">
    <h3 class="text-base font-semibold text-zinc-900 dark:text-zinc-50">
      {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
    </h3>

    <p v-if="sync.error" class="text-sm text-red-600 dark:text-red-400" role="alert">
      {{ sync.error }}
    </p>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
      <input
        v-model="email"
        type="email"
        required
        autocomplete="email"
        class="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-sm font-medium text-zinc-700 dark:text-zinc-300">Password</label>
      <input
        v-model="password"
        type="password"
        required
        :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
        class="rounded border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
    </div>

    <button
      type="submit"
      class="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
      :disabled="!email || !password"
    >
      {{ mode === 'signin' ? 'Sign in' : 'Create account' }}
    </button>

    <p class="text-xs text-center text-zinc-500 dark:text-zinc-400">
      <button
        type="button"
        class="underline underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
        @click="mode = mode === 'signin' ? 'signup' : 'signin'"
      >
        {{ mode === 'signin' ? "Don't have an account?" : 'Already have an account?' }}
      </button>
    </p>
  </form>

  <div v-else class="flex flex-col gap-2">
    <div class="flex items-center gap-2">
      <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
        <span class="relative h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
        Connected to Supabase
      </span>
      <span class="text-sm text-zinc-500 dark:text-zinc-400">as {{ sync.user?.email }}</span>
    </div>

    <p v-if="sync.error" class="text-sm text-red-600 dark:text-red-400" role="alert">
      {{ sync.error }}
    </p>

    <div class="flex items-center justify-between gap-2">
      <span class="text-sm text-zinc-500 dark:text-zinc-400">Cloud sync</span>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        @click="sync.signOut()"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l3 3M16 3l3 3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Sign out
      </button>
    </div>
    <p class="text-[11px] text-zinc-400 dark:text-zinc-500">
      Metadata, reading positions, highlights and bookmarks sync across devices. EPUB files stay on the device they were imported to.
    </p>
  </div>
</template>
