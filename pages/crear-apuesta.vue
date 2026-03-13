<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { ref, onMounted, computed } from 'vue'
import { useNuxtApp, navigateTo } from '#imports'
import { useAuth } from '~/composables/useAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

type Player = {
  id: string
  name: string
  surname: string
}

type Template = {
  id: string
  name: string
  template_type: 'boolean' | 'quantity' | 'time'
  unit: string | null
}

type DraftEvent = {
  template_id: string
  template_name: string
  template_type: 'boolean' | 'quantity' | 'time'
  odds: number
  mode: string | null
  threshold_value: number | null
  target_time: string | null
}

const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }
const { user } = useAuth()

const title = ref('')
const eventDate = ref('')
const subjectUserId = ref('')

const players = ref<Player[]>([])
const templates = ref<Template[]>([])

const draftEvents = ref<DraftEvent[]>([])

const selectedTemplateId = ref('')
const odds = ref<number | null>(null)
const mode = ref('')
const thresholdValue = ref<number | null>(null)
const targetTime = ref('')

const loading = ref(true)
const saving = ref(false)
const errorMsg = ref('')

const selectedTemplate = computed(() =>
  templates.value.find((t) => t.id === selectedTemplateId.value)
)

onMounted(async () => {
  const playersRes = await $supabase
    .from('profiles')
    .select('id,name,surname')
    .order('name')

  const templatesRes = await $supabase
    .from('event_templates')
    .select('id,name,template_type,unit')
    .eq('is_active', true)
    .order('name')

  if (playersRes.data) players.value = playersRes.data as Player[]
  if (templatesRes.data) templates.value = templatesRes.data as Template[]

  loading.value = false
})

function resetEventForm() {
  selectedTemplateId.value = ''
  odds.value = null
  mode.value = ''
  thresholdValue.value = null
  targetTime.value = ''
}

function addDraftEvent() {
  if (!selectedTemplate.value) {
    errorMsg.value = 'Selecciona un evento'
    return
  }

  if (!odds.value || odds.value <= 1) {
    errorMsg.value = 'La cuota debe ser mayor que 1'
    return
  }

  const event: DraftEvent = {
    template_id: selectedTemplate.value.id,
    template_name: selectedTemplate.value.name,
    template_type: selectedTemplate.value.template_type,
    odds: odds.value,
    mode: null,
    threshold_value: null,
    target_time: null,
  }

  if (selectedTemplate.value.template_type === 'quantity') {
    if (!mode.value || thresholdValue.value === null) {
      errorMsg.value = 'Completa los datos del evento'
      return
    }

    event.mode = mode.value
    event.threshold_value = thresholdValue.value
  }

  if (selectedTemplate.value.template_type === 'time') {
    if (!mode.value || !targetTime.value) {
      errorMsg.value = 'Completa los datos del evento'
      return
    }

    event.mode = mode.value
    event.target_time = targetTime.value
  }

  draftEvents.value.push(event)

  resetEventForm()
  errorMsg.value = ''
}

function removeDraftEvent(index: number) {
  draftEvents.value.splice(index, 1)
}

function buildDateTimes(dateStr: string) {
  return {
    oddsLockAt: `${dateStr}T00:00:00`,
    bettingCloseAt: `${dateStr}T18:00:00`,
  }
}

async function createBet() {
  if (!title.value || !eventDate.value || !subjectUserId.value) {
    errorMsg.value = 'Completa todos los campos'
    return
  }

  if (draftEvents.value.length === 0) {
    errorMsg.value = 'Añade al menos un evento'
    return
  }

  saving.value = true

  const { oddsLockAt, bettingCloseAt } = buildDateTimes(eventDate.value)

  const betInsert = await $supabase
    .from('bets')
    .insert({
      title: title.value,
      bank_user_id: user.value?.id,
      subject_user_id: subjectUserId.value,
      event_date: eventDate.value,
      odds_lock_at: oddsLockAt,
      betting_close_at: bettingCloseAt,
      status: 'open',
    })
    .select()
    .single()

  if (betInsert.error) {
    errorMsg.value = betInsert.error.message
    saving.value = false
    return
  }

  const betId = betInsert.data.id

  const eventsPayload = draftEvents.value.map((e) => ({
    bet_id: betId,
    template_id: e.template_id,
    odds: e.odds,
    mode: e.mode,
    threshold_value: e.threshold_value,
    target_time: e.target_time,
  }))

  const eventsInsert = await $supabase
    .from('bet_events')
    .insert(eventsPayload)

  saving.value = false

  if (eventsInsert.error) {
    errorMsg.value = eventsInsert.error.message
    return
  }

  await navigateTo('/apostar')
}
</script>

<template>
  <div>
    <AppNavbar />

    <div class="container py-5">

      <h1 class="mb-4">Crear apuesta</h1>

      <div class="card mb-4">
        <div class="card-body">

          <div class="mb-3">
            <label class="form-label">Nombre</label>
            <input v-model="title" class="form-control">
          </div>

          <div class="mb-3">
            <label class="form-label">Fecha</label>
            <input v-model="eventDate" type="date" class="form-control">
          </div>

          <div class="mb-3">
            <label class="form-label">Sujeto</label>
            <select v-model="subjectUserId" class="form-select">
              <option disabled value="">Selecciona jugador</option>
              <option
                v-for="player in players"
                :key="player.id"
                :value="player.id"
              >
                {{ player.name }} {{ player.surname }}
              </option>
            </select>
          </div>

        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body">

          <h4 class="mb-3">Añadir evento</h4>

          <div class="mb-3">
            <select v-model="selectedTemplateId" class="form-select">
              <option disabled value="">Selecciona evento</option>
              <option
                v-for="t in templates"
                :key="t.id"
                :value="t.id"
              >
                {{ t.name }} ({{ t.template_type }})
              </option>
            </select>
          </div>

          <div v-if="selectedTemplate?.template_type === 'quantity'" class="row">

            <div class="col-md-6 mb-3">
              <select v-model="mode" class="form-select">
                <option disabled value="">Modo</option>
                <option value="gte">X o más</option>
                <option value="lt">Menos de X</option>
              </select>
            </div>

            <div class="col-md-6 mb-3">
              <input
                v-model.number="thresholdValue"
                type="number"
                class="form-control"
                placeholder="Cantidad"
              >
            </div>

          </div>

          <div v-if="selectedTemplate?.template_type === 'time'" class="row">

            <div class="col-md-6 mb-3">
              <select v-model="mode" class="form-select">
                <option disabled value="">Modo</option>
                <option value="before">Antes de</option>
                <option value="after">Más tarde de</option>
              </select>
            </div>

            <div class="col-md-6 mb-3">
              <input
                v-model="targetTime"
                type="time"
                step="1800"
                class="form-control"
              >
            </div>

          </div>

          <div class="mb-3">
            <input
              v-model.number="odds"
              type="number"
              step="0.01"
              class="form-control"
              placeholder="Cuota"
            >
          </div>

          <button class="btn btn-primary" @click="addDraftEvent">
            Añadir evento
          </button>

        </div>
      </div>

      <div class="card mb-4">
        <div class="card-body">

          <h4>Eventos añadidos</h4>

          <ul class="list-group">

            <li
              v-for="(e,index) in draftEvents"
              :key="index"
              class="list-group-item d-flex justify-content-between"
            >
              {{ e.template_name }} - cuota {{ e.odds }}

              <button
                class="btn btn-sm btn-danger"
                @click="removeDraftEvent(index)"
              >
                eliminar
              </button>

            </li>

          </ul>

        </div>
      </div>

      <button
        class="btn btn-success"
        :disabled="saving"
        @click="createBet"
      >
        {{ saving ? 'Creando...' : 'Crear apuesta completa' }}
      </button>

      <div v-if="errorMsg" class="alert alert-danger mt-3">
        {{ errorMsg }}
      </div>

    </div>
  </div>
</template>