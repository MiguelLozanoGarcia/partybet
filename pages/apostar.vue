<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { ref, onMounted } from 'vue'
import { useNuxtApp } from '#imports'
import type { SupabaseClient } from '@supabase/supabase-js'

type BetRow = {
  id: string
  title: string
  event_date: string
  bank_user_id: string
  subject_user_id: string
  status: string
  bank_profile?: {
  name: string
  surname: string
} | null

subject_profile?: {
  name: string
  surname: string
} | null
}

const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }

const bets = ref<BetRow[]>([])
const errorMsg = ref('')
const loading = ref(true)

onMounted(async () => {
  const { data, error } = await $supabase
    .from('bets')
    .select(`
      id,
      title,
      event_date,
      bank_user_id,
      subject_user_id,
      status,
      bank_profile:profiles!bets_bank_user_id_fkey(name, surname),
      subject_profile:profiles!bets_subject_user_id_fkey(name, surname)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  loading.value = false

  if (error) {
    errorMsg.value = error.message
    return
  }

bets.value = (data ?? []).map((bet: any) => ({
  ...bet,
  bank_profile: Array.isArray(bet.bank_profile)
    ? bet.bank_profile[0]
    : bet.bank_profile,
  subject_profile: Array.isArray(bet.subject_profile)
    ? bet.subject_profile[0]
    : bet.subject_profile
}))})
</script>

<template>
  <div>
    <AppNavbar />

    <div class="container py-5">
      <h1 class="mb-4">Apuestas abiertas</h1>

      <div v-if="loading" class="alert alert-info">
        Cargando apuestas...
      </div>

      <div v-else-if="errorMsg" class="alert alert-danger">
        {{ errorMsg }}
      </div>

      <div v-else-if="bets.length === 0" class="alert alert-secondary">
        No hay apuestas abiertas.
      </div>

      <div
        v-else
        v-for="bet in bets"
        :key="bet.id"
        class="card shadow-sm mb-3"
      >
        <div class="card-body">
          <h5 class="card-title">{{ bet.title }}</h5>

          <p class="card-text mb-1">
            <strong>Banca:</strong>
{{ bet.bank_profile?.name }} {{ bet.bank_profile?.surname }}
          </p>

          <p class="card-text mb-1">
            <strong>Sujeto:</strong>
{{ bet.subject_profile?.name }} {{ bet.subject_profile?.surname }}
          </p>

          <p class="card-text mb-3">
            <strong>Fecha:</strong> {{ bet.event_date }}
          </p>

          <NuxtLink
            :to="`/apuestas/${bet.id}`"
            class="btn btn-success"
          >
            Ver apuesta
          </NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>