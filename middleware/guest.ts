import { navigateTo } from '#imports'
import { useAuth } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const { user, initAuth } = useAuth()

  await initAuth()

  if (user.value) {
    return navigateTo('/home')
  }
})