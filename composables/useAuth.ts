import { ref } from 'vue'
import { useNuxtApp } from '#imports'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'

const session = ref<Session | null>(null)
const user = ref<User | null>(null)
const authLoaded = ref(false)
let authListenerInitialized = false

export function useAuth() {
  const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }

  async function initAuth() {
    if (authLoaded.value) return

    const { data, error } = await $supabase.auth.getSession()

    if (error) {
      session.value = null
      user.value = null
      authLoaded.value = true
      return
    }

    session.value = data.session
    user.value = data.session?.user ?? null
    authLoaded.value = true

    if (!authListenerInitialized) {
      $supabase.auth.onAuthStateChange((_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
      })

      authListenerInitialized = true
    }
  }

  async function signOut() {
    await $supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  return {
    session,
    user,
    authLoaded,
    initAuth,
    signOut,
  }
}