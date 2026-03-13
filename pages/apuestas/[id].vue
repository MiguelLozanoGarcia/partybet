<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { computed, onMounted, ref } from 'vue'
import { useNuxtApp, useRoute } from '#imports'
import { useAuth } from '~/composables/useAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

type EventTemplate = {
  id: string
  name: string
  template_type: 'boolean' | 'quantity' | 'time'
  unit: string | null
}

type BetDetail = {
  id: string
  title: string
  event_date: string
  bank_user_id: string
  subject_user_id: string
  odds_lock_at: string
  betting_close_at: string
  status: string
  bank_name?: string
  bank_surname?: string
  subject_name?: string
  subject_surname?: string
}

type BetEvent = {
  id: string
  odds: number
  mode: string | null
  threshold_value: number | null
  target_time: string | null
  result: string
  template?: {
    name: string
    template_type: 'boolean' | 'quantity' | 'time'
    unit: string | null
  }[] | null
}

type ExistingUserBet = {
  id: string
  stake: number
  total_odds: number
  potential_win: number
  status: string
}

const route = useRoute()
const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }
const { user } = useAuth()

const bet = ref<BetDetail | null>(null)
const templates = ref<EventTemplate[]>([])
const betEvents = ref<BetEvent[]>([])
const existingUserBet = ref<ExistingUserBet | null>(null)

const selectedEventIds = ref<string[]>([])
const stake = ref<number | null>(1)

const loading = ref(true)
const saving = ref(false)
const placingBet = ref(false)

const errorMsg = ref('')
const successMsg = ref('')
const betSubmitMsg = ref('')
const betSubmitError = ref('')

const selectedTemplateId = ref('')
const odds = ref<number | null>(null)
const mode = ref('')
const thresholdValue = ref<number | null>(null)
const targetTime = ref('')

const selectedTemplate = computed(() =>
  templates.value.find((t) => t.id === selectedTemplateId.value) ?? null
)

const isBank = computed(() => bet.value?.bank_user_id === user.value?.id)
const isSubject = computed(() => bet.value?.subject_user_id === user.value?.id)

const now = computed(() => new Date())

const isOddsLocked = computed(() => {
  if (!bet.value?.odds_lock_at) return false
  return now.value >= new Date(bet.value.odds_lock_at)
})

const isBettingClosed = computed(() => {
  if (!bet.value?.betting_close_at) return false
  return now.value >= new Date(bet.value.betting_close_at)
})

const canEditAsBank = computed(() => {
  return isBank.value && !isOddsLocked.value
})

const canBet = computed(() => {
  return !!bet.value && !isBank.value && !isSubject.value && !isBettingClosed.value
})

const selectedEvents = computed(() => {
  return betEvents.value.filter((event) => selectedEventIds.value.includes(event.id))
})

const totalOdds = computed(() => {
  if (selectedEvents.value.length === 0) return 0

  return selectedEvents.value.reduce((acc, event) => {
    return acc * Number(event.odds)
  }, 1)
})

const potentialWin = computed(() => {
  if (!stake.value || stake.value <= 0 || totalOdds.value <= 0) return 0
  return Number((stake.value * totalOdds.value).toFixed(2))
})

async function loadBet() {
  errorMsg.value = ''

  const { data, error } = await $supabase
    .from('bets')
    .select('*')
    .eq('id', route.params.id)
    .single()

  if (error) {
    console.log('LOAD BET ERROR', error)
    errorMsg.value = error.message
    return
  }

  const bankProfile = await $supabase
    .from('profiles')
    .select('name,surname')
    .eq('id', data.bank_user_id)
    .single()

  const subjectProfile = await $supabase
    .from('profiles')
    .select('name,surname')
    .eq('id', data.subject_user_id)
    .single()

  bet.value = {
    ...data,
    bank_name: bankProfile.data?.name,
    bank_surname: bankProfile.data?.surname,
    subject_name: subjectProfile.data?.name,
    subject_surname: subjectProfile.data?.surname,
  }
}

async function loadTemplates() {
  const { data, error } = await $supabase
    .from('event_templates')
    .select('id, name, template_type, unit')
    .eq('is_active', true)
    .order('name')

  if (error) {
    console.log('LOAD TEMPLATES ERROR', error)
    errorMsg.value = error.message
    return
  }

  templates.value = (data as EventTemplate[]) ?? []
}

async function loadBetEvents() {
  const { data, error } = await $supabase
    .from('bet_events')
    .select(`
      id,
      odds,
      mode,
      threshold_value,
      target_time,
      result,
      template:event_templates(name, template_type, unit)
    `)
    .eq('bet_id', route.params.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.log('LOAD BET EVENTS ERROR', error)
    errorMsg.value = error.message
    return
  }

  betEvents.value = (data as BetEvent[]) ?? []
}

async function loadUserBet() {
  betSubmitError.value = ''
  betSubmitMsg.value = ''

  if (!user.value?.id) return
  if (!bet.value?.id) return
  if (isBank.value || isSubject.value) return

  const { data, error } = await $supabase
    .from('user_bets')
    .select('id, stake, total_odds, potential_win, status')
    .eq('bet_id', bet.value.id)
    .eq('user_id', user.value.id)
    .maybeSingle()

  if (error) {
    console.log('LOAD USER BET ERROR', error)
    betSubmitError.value = error.message
    return
  }

  existingUserBet.value = (data as ExistingUserBet | null) ?? null

  if (!existingUserBet.value) {
    selectedEventIds.value = []
    stake.value = 1
    return
  }

  const selections = await $supabase
    .from('selections')
    .select('bet_event_id')
    .eq('user_bet_id', existingUserBet.value.id)

  if (selections.error) {
    console.log('LOAD SELECTIONS ERROR', selections.error)
    betSubmitError.value = selections.error.message
    return
  }

  selectedEventIds.value = (selections.data ?? []).map((s: any) => s.bet_event_id)
  stake.value = existingUserBet.value.stake
}

function resetForm() {
  selectedTemplateId.value = ''
  odds.value = null
  mode.value = ''
  thresholdValue.value = null
  targetTime.value = ''
}

function formatEventLabel(event: BetEvent) {
  const template = Array.isArray(event.template)
    ? event.template[0]
    : event.template

  if (!template) return 'Evento'

  const name = template.name

  if (template.template_type === 'boolean') {
    return name
  }

  if (template.template_type === 'quantity') {
    const labelMode =
      event.mode === 'gte'
        ? `${event.threshold_value} o más`
        : `menos de ${event.threshold_value}`

    return `${name} · ${labelMode}`
  }

  if (template.template_type === 'time') {
    const labelMode =
      event.mode === 'before'
        ? 'antes de'
        : 'después de'

    return `${name} · ${labelMode} ${event.target_time?.slice(0, 5)}`
  }

  return name
}

async function addEvent() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!canEditAsBank.value) {
    errorMsg.value = 'La banca ya no puede editar esta apuesta'
    return
  }

  if (!bet.value) {
    errorMsg.value = 'Apuesta no encontrada'
    return
  }

  if (!selectedTemplate.value) {
    errorMsg.value = 'Selecciona un evento'
    return
  }

  if (!odds.value || odds.value <= 1) {
    errorMsg.value = 'Introduce una cuota válida'
    return
  }

  const payload: Record<string, any> = {
    bet_id: bet.value.id,
    template_id: selectedTemplate.value.id,
    odds: odds.value,
  }

  if (selectedTemplate.value.template_type === 'quantity') {
    if (!mode.value) {
      errorMsg.value = 'Selecciona el modo'
      return
    }

    if (thresholdValue.value === null || thresholdValue.value < 0) {
      errorMsg.value = 'Introduce una cantidad válida'
      return
    }

    payload.mode = mode.value
    payload.threshold_value = thresholdValue.value
  }

  if (selectedTemplate.value.template_type === 'time') {
    if (!mode.value) {
      errorMsg.value = 'Selecciona antes o después'
      return
    }

    if (!targetTime.value) {
      errorMsg.value = 'Selecciona una hora'
      return
    }

    payload.mode = mode.value
    payload.target_time = targetTime.value
  }

  saving.value = true

  const { error } = await $supabase
    .from('bet_events')
    .insert(payload)

  saving.value = false

  if (error) {
    console.log('ADD EVENT ERROR', error)
    errorMsg.value = error.message
    return
  }

  successMsg.value = 'Evento añadido correctamente'
  resetForm()
  await loadBetEvents()
}

async function updateOdds(eventId: string, newOdds: number) {
  if (!canEditAsBank.value) {
    alert('La banca ya no puede editar cuotas')
    return
  }

  if (!newOdds || newOdds <= 1) {
    alert('La cuota debe ser mayor que 1')
    return
  }

  const { error } = await $supabase
    .from('bet_events')
    .update({ odds: newOdds })
    .eq('id', eventId)

  if (error) {
    console.log('UPDATE ODDS ERROR', error)
    return
  }

  await loadBetEvents()
  await loadUserBet()
}

async function deleteEvent(eventId: string) {
  if (!canEditAsBank.value) {
    alert('La banca ya no puede eliminar eventos')
    return
  }

  const confirmDelete = confirm('¿Eliminar este evento?')
  if (!confirmDelete) return

  const { error } = await $supabase
    .from('bet_events')
    .delete()
    .eq('id', eventId)

  if (error) {
    console.log('DELETE EVENT ERROR', error)
    return
  }

  await loadBetEvents()
  await loadUserBet()
}

function toggleSelection(eventId: string) {
  if (selectedEventIds.value.includes(eventId)) {
    selectedEventIds.value = selectedEventIds.value.filter((id) => id !== eventId)
    return
  }

  selectedEventIds.value.push(eventId)
}

async function placeBet() {
  betSubmitMsg.value = ''
  betSubmitError.value = ''

  if (!bet.value) {
    betSubmitError.value = 'Apuesta no encontrada'
    return
  }

  if (!user.value?.id) {
    betSubmitError.value = 'Usuario no encontrado'
    return
  }

  if (isBank.value) {
    betSubmitError.value = 'La banca no puede apostar'
    return
  }

  if (isSubject.value) {
    betSubmitError.value = 'El sujeto no puede apostar'
    return
  }

  if (isBettingClosed.value) {
    betSubmitError.value = 'El plazo para apostar ya ha cerrado'
    return
  }

  if (selectedEvents.value.length === 0) {
    betSubmitError.value = 'Selecciona al menos un evento'
    return
  }

  if (!stake.value || stake.value < 1 || stake.value > 5) {
    betSubmitError.value = 'La apuesta debe ser entre 1€ y 5€'
    return
  }

  placingBet.value = true

  if (!existingUserBet.value) {
    const userBetInsert = await $supabase
      .from('user_bets')
      .insert({
        bet_id: bet.value.id,
        user_id: user.value.id,
        stake: stake.value,
        total_odds: Number(totalOdds.value.toFixed(2)),
        potential_win: potentialWin.value,
        status: 'pending',
      })
      .select()
      .single()

    if (userBetInsert.error) {
      placingBet.value = false
      console.log('USER BET INSERT ERROR', userBetInsert.error)
      betSubmitError.value = userBetInsert.error.message
      return
    }

    const userBetId = userBetInsert.data.id

    const selectionsPayload = selectedEvents.value.map((event) => ({
      user_bet_id: userBetId,
      bet_event_id: event.id,
    }))

    const selectionsInsert = await $supabase
      .from('selections')
      .insert(selectionsPayload)

    placingBet.value = false

    if (selectionsInsert.error) {
      console.log('SELECTIONS INSERT ERROR', selectionsInsert.error)
      betSubmitError.value = selectionsInsert.error.message
      return
    }

    betSubmitMsg.value = 'Apuesta realizada correctamente'
  } else {
    const updateUserBet = await $supabase
      .from('user_bets')
      .update({
        stake: stake.value,
        total_odds: Number(totalOdds.value.toFixed(2)),
        potential_win: potentialWin.value,
      })
      .eq('id', existingUserBet.value.id)

    if (updateUserBet.error) {
      placingBet.value = false
      console.log('USER BET UPDATE ERROR', updateUserBet.error)
      betSubmitError.value = updateUserBet.error.message
      return
    }

    const deleteSelections = await $supabase
      .from('selections')
      .delete()
      .eq('user_bet_id', existingUserBet.value.id)

    if (deleteSelections.error) {
      placingBet.value = false
      console.log('DELETE SELECTIONS ERROR', deleteSelections.error)
      betSubmitError.value = deleteSelections.error.message
      return
    }

    const selectionsPayload = selectedEvents.value.map((event) => ({
      user_bet_id: existingUserBet.value!.id,
      bet_event_id: event.id,
    }))

    const selectionsInsert = await $supabase
      .from('selections')
      .insert(selectionsPayload)

    placingBet.value = false

    if (selectionsInsert.error) {
      console.log('SELECTIONS UPDATE INSERT ERROR', selectionsInsert.error)
      betSubmitError.value = selectionsInsert.error.message
      return
    }

    betSubmitMsg.value = 'Apuesta actualizada correctamente'
  }

  await loadUserBet()
}

onMounted(async () => {
  await loadBet()
  await loadTemplates()
  await loadBetEvents()
  await loadUserBet()
  loading.value = false
})
</script>

<template>
  <div>
    <AppNavbar />

    <div class="container py-5">
      <div v-if="loading" class="alert alert-info">
        Cargando apuesta...
      </div>

      <div v-else-if="errorMsg && !bet" class="alert alert-danger">
        {{ errorMsg }}
      </div>

      <div v-else-if="bet">
        <h1 class="mb-2">{{ bet.title }}</h1>

        <p class="mb-1">
          <strong>Banca:</strong>
          {{ bet.bank_name }} {{ bet.bank_surname }}
        </p>

        <p class="mb-1">
          <strong>Sujeto:</strong>
          {{ bet.subject_name }} {{ bet.subject_surname }}
        </p>

        <p class="mb-1">
          <strong>Fecha:</strong> {{ bet.event_date }}
        </p>
        <NuxtLink
v-if="isBank && bet.status !== 'resolved'"
:to="`/resolver/${bet.id}`"
class="btn btn-warning mb-3"
>
Resolver apuesta
</NuxtLink>

        <p class="mb-1">
          <strong>Edición banca hasta:</strong>
          {{ new Date(bet.odds_lock_at).toLocaleString() }}
        </p>

        <p class="mb-4">
          <strong>Apuestas hasta:</strong>
          {{ new Date(bet.betting_close_at).toLocaleString() }}
        </p>

        <div v-if="isSubject" class="alert alert-warning">
          No puedes apostar en esta apuesta porque eres el sujeto.
        </div>

        <div v-if="isBank && isOddsLocked" class="alert alert-warning">
          La banca ya no puede editar esta apuesta.
        </div>

        <div v-if="!isBank && isBettingClosed" class="alert alert-warning">
          El plazo para apostar ya ha cerrado.
        </div>

        <div v-if="canEditAsBank" class="card mb-4 shadow-sm">
          <div class="card-body">
            <h4 class="mb-3">Añadir evento</h4>

            <div class="mb-3">
              <label class="form-label">Evento</label>
              <select v-model="selectedTemplateId" class="form-select">
                <option disabled value="">Selecciona evento</option>
                <option
                  v-for="template in templates"
                  :key="template.id"
                  :value="template.id"
                >
                  {{ template.name }}
                </option>
              </select>
            </div>

            <div v-if="selectedTemplate?.template_type === 'quantity'" class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Modo</label>
                <select v-model="mode" class="form-select">
                  <option disabled value="">Selecciona</option>
                  <option value="gte">X o más</option>
                  <option value="lt">Menos de X</option>
                </select>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label">Cantidad</label>
                <input
                  v-model.number="thresholdValue"
                  type="number"
                  min="0"
                  class="form-control"
                />
              </div>
            </div>

            <div v-if="selectedTemplate?.template_type === 'time'" class="row">
              <div class="col-md-6 mb-3">
                <label class="form-label">Modo</label>
                <select v-model="mode" class="form-select">
                  <option disabled value="">Selecciona</option>
                  <option value="before">Antes de</option>
                  <option value="after">Después de</option>
                </select>
              </div>

              <div class="col-md-6 mb-3">
                <label class="form-label">Hora</label>
                <input
                  v-model="targetTime"
                  type="time"
                  step="1800"
                  class="form-control"
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label">Cuota</label>
              <input
                v-model.number="odds"
                type="number"
                min="1.01"
                step="0.01"
                class="form-control"
                placeholder="Ej. 2.50"
              />
            </div>

            <button
              class="btn btn-primary"
              :disabled="saving"
              @click="addEvent"
            >
              {{ saving ? 'Guardando...' : 'Añadir evento' }}
            </button>

            <div v-if="errorMsg" class="alert alert-danger mt-3 mb-0">
              {{ errorMsg }}
            </div>

            <div v-if="successMsg" class="alert alert-success mt-3 mb-0">
              {{ successMsg }}
            </div>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-body">
            <h4 class="mb-3">Eventos</h4>

            <div v-if="betEvents.length === 0" class="alert alert-secondary">
              No hay eventos todavía.
            </div>

            <ul v-else class="list-group">
              <li
                v-for="event in betEvents"
                :key="event.id"
                class="list-group-item d-flex justify-content-between align-items-center"
              >
                <div class="d-flex align-items-center gap-3">
                  <input
                    v-if="canBet"
                    type="checkbox"
                    class="form-check-input"
                    :checked="selectedEventIds.includes(event.id)"
                    @change="toggleSelection(event.id)"
                  />

                  <div>
                    <span>{{ formatEventLabel(event) }}</span>

                    <span class="badge text-bg-primary ms-2">
                      Cuota {{ event.odds }}
                    </span>
                  </div>
                </div>

                <div v-if="isBank && !isOddsLocked" class="d-flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    class="form-control form-control-sm"
                    style="width: 100px"
                    :placeholder="String(event.odds)"
                    @change="(e) => updateOdds(event.id, Number((e.target as HTMLInputElement).value))"
                  />

                  <button
                    class="btn btn-danger btn-sm"
                    @click="deleteEvent(event.id)"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <div v-if="canBet || existingUserBet" class="card shadow-sm mt-4">
          <div class="card-body">
            <h4 class="mb-3">
              {{ existingUserBet ? 'Editar tu apuesta' : 'Tu apuesta' }}
            </h4>

            <div v-if="selectedEvents.length === 0" class="alert alert-secondary">
              Selecciona uno o varios eventos para hacer tu apuesta.
            </div>

            <ul v-else class="list-group mb-3">
              <li
                v-for="event in selectedEvents"
                :key="event.id"
                class="list-group-item d-flex justify-content-between"
              >
                <span>{{ formatEventLabel(event) }}</span>
                <span>Cuota {{ event.odds }}</span>
              </li>
            </ul>

            <div class="row">
              <div class="col-md-4 mb-3">
                <label class="form-label">Dinero apostado (€)</label>
                <input
                  v-model.number="stake"
                  type="number"
                  min="1"
                  max="5"
                  step="0.01"
                  class="form-control"
                  :disabled="isBettingClosed"
                  placeholder="Entre 1 y 5€"
                />
              </div>

              <div class="col-md-4 mb-3">
                <label class="form-label">Cuota total</label>
                <input
                  :value="totalOdds ? totalOdds.toFixed(2) : ''"
                  class="form-control"
                  disabled
                />
              </div>

              <div class="col-md-4 mb-3">
                <label class="form-label">Ganancia potencial</label>
                <input
                  :value="potentialWin ? potentialWin.toFixed(2) + ' €' : ''"
                  class="form-control"
                  disabled
                />
              </div>
            </div>

            <button
              v-if="!isBettingClosed"
              class="btn btn-success"
              :disabled="placingBet"
              @click="placeBet"
            >
              {{
                placingBet
                  ? 'Guardando...'
                  : existingUserBet
                    ? 'Actualizar apuesta'
                    : 'Apostar'
              }}
            </button>

            <div v-if="betSubmitError" class="alert alert-danger mt-3 mb-0">
              {{ betSubmitError }}
            </div>

            <div v-if="betSubmitMsg" class="alert alert-success mt-3 mb-0">
              {{ betSubmitMsg }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>