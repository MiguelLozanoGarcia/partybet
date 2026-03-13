<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { onMounted, ref } from 'vue'
import { useNuxtApp } from '#imports'
import { useAuth } from '~/composables/useAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

type Profile = {
  id: string
  name: string
  surname: string
}

type CreatedBet = {
  id: string
  title: string
  event_date: string
  status: string
  subject_name?: string
  subject_surname?: string
}

type UserBetRow = {
  id: string
  bet_id: string
  stake: number
  total_odds: number
  potential_win: number
  status: string
  bet_title?: string
  event_date?: string
}

const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }
const { user } = useAuth()

const loading = ref(true)
const errorMsg = ref('')

const profile = ref<Profile | null>(null)
const createdBets = ref<CreatedBet[]>([])
const userBets = ref<UserBetRow[]>([])

async function loadProfile() {
  if (!user.value?.id) return

  const { data, error } = await $supabase
    .from('profiles')
    .select('id, name, surname')
    .eq('id', user.value.id)
    .single()

  if (error) {
    errorMsg.value = error.message
    return
  }

  profile.value = data as Profile
}

async function loadCreatedBets() {
  if (!user.value?.id) return

  const { data, error } = await $supabase
    .from('bets')
    .select('id, title, event_date, status, subject_user_id')
    .eq('bank_user_id', user.value.id)
    .order('created_at', { ascending: false })

  if (error) {
    errorMsg.value = error.message
    return
  }

  const rows = (data ?? []) as any[]

  const enriched = await Promise.all(
    rows.map(async (bet) => {
      const subjectProfile = await $supabase
        .from('profiles')
        .select('name, surname')
        .eq('id', bet.subject_user_id)
        .single()

      return {
        id: bet.id,
        title: bet.title,
        event_date: bet.event_date,
        status: bet.status,
        subject_name: subjectProfile.data?.name,
        subject_surname: subjectProfile.data?.surname,
      }
    })
  )

  createdBets.value = enriched
}

async function loadUserBets() {
  if (!user.value?.id) return

  const { data, error } = await $supabase
    .from('user_bets')
    .select('id, bet_id, stake, total_odds, potential_win, status')
    .eq('user_id', user.value.id)
    .order('created_at', { ascending: false })

  if (error) {
    errorMsg.value = error.message
    return
  }

  const rows = (data ?? []) as any[]

  const enriched = await Promise.all(
    rows.map(async (userBet) => {
      const betRes = await $supabase
        .from('bets')
        .select('title, event_date')
        .eq('id', userBet.bet_id)
        .single()

      return {
        id: userBet.id,
        bet_id: userBet.bet_id,
        stake: userBet.stake,
        total_odds: userBet.total_odds,
        potential_win: userBet.potential_win,
        status: userBet.status,
        bet_title: betRes.data?.title,
        event_date: betRes.data?.event_date,
      }
    })
  )

  userBets.value = enriched
}

onMounted(async () => {
  await loadProfile()
  await loadCreatedBets()
  await loadUserBets()
  loading.value = false
})
</script>

<template>
  <div>
    <AppNavbar />

    <div class="container py-5">
      <div v-if="loading" class="alert alert-info">
        Cargando perfil...
      </div>

      <div v-else-if="errorMsg" class="alert alert-danger">
        {{ errorMsg }}
      </div>

      <div v-else>
        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h1 class="mb-2">Perfil</h1>

            <p class="mb-1">
              <strong>Nombre:</strong>
              {{ profile?.name }} {{ profile?.surname }}
            </p>

            <p class="mb-0">
              <strong>Email:</strong>
              {{ user?.email }}
            </p>
          </div>
        </div>

        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h3 class="mb-3">Apuestas creadas por ti</h3>

            <div v-if="createdBets.length === 0" class="alert alert-secondary mb-0">
              No has creado apuestas todavía.
            </div>

            <div
              v-for="bet in createdBets"
              :key="bet.id"
              class="card border mb-3"
            >
              <div class="card-body">
                <h5 class="card-title">{{ bet.title }}</h5>

                <p class="mb-1">
                  <strong>Sujeto:</strong>
                  {{ bet.subject_name }} {{ bet.subject_surname }}
                </p>

                <p class="mb-1">
                  <strong>Fecha:</strong>
                  {{ bet.event_date }}
                </p>

                <p class="mb-3">
                  <strong>Estado:</strong>
                  {{ bet.status }}
                </p>

                <NuxtLink
                  :to="`/apuestas/${bet.id}`"
                  class="btn btn-primary"
                >
                  Ver apuesta
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="mb-3">Tus apuestas</h3>

            <div v-if="userBets.length === 0" class="alert alert-secondary mb-0">
              No has apostado todavía.
            </div>

            <div
              v-for="userBet in userBets"
              :key="userBet.id"
              class="card border mb-3"
            >
              <div class="card-body">
                <h5 class="card-title">{{ userBet.bet_title }}</h5>

                <p class="mb-1">
                  <strong>Fecha:</strong>
                  {{ userBet.event_date }}
                </p>

                <p class="mb-1">
                  <strong>Dinero apostado:</strong>
                  {{ userBet.stake }} €
                </p>

                <p class="mb-1">
                  <strong>Cuota total:</strong>
                  {{ userBet.total_odds }}
                </p>

                <p class="mb-3">
                  <strong>Ganancia potencial:</strong>
                  {{ userBet.potential_win }} €
                </p>

                <NuxtLink
                  :to="`/apuestas/${userBet.bet_id}`"
                  class="btn btn-success"
                >
                  Ver apuesta
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>