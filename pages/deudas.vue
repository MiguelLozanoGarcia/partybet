<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { onMounted, ref, computed } from 'vue'
import { useNuxtApp } from '#imports'
import { useAuth } from '~/composables/useAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

type DebtRow = {
  id: string
  from_user_id: string
  to_user_id: string
  amount: number
  reason: string | null
  settled: boolean
  created_at: string
  from_name?: string
  from_surname?: string
  to_name?: string
  to_surname?: string
}

const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }
const { user } = useAuth()

const loading = ref(true)
const errorMsg = ref('')
const successMsg = ref('')

const debts = ref<DebtRow[]>([])

const debtsYouOwe = computed(() =>
  debts.value.filter((debt) => debt.from_user_id === user.value?.id)
)

const debtsOwedToYou = computed(() =>
  debts.value.filter((debt) => debt.to_user_id === user.value?.id)
)

const pendingYouOweTotal = computed(() =>
  debtsYouOwe.value
    .filter((debt) => !debt.settled)
    .reduce((acc, debt) => acc + Number(debt.amount), 0)
)

const pendingOwedToYouTotal = computed(() =>
  debtsOwedToYou.value
    .filter((debt) => !debt.settled)
    .reduce((acc, debt) => acc + Number(debt.amount), 0)
)

async function loadDebts() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!user.value?.id) {
    errorMsg.value = 'Usuario no encontrado'
    loading.value = false
    return
  }

  const { data, error } = await $supabase
    .from('debts')
    .select('*')
    .or(`from_user_id.eq.${user.value.id},to_user_id.eq.${user.value.id}`)
    .order('created_at', { ascending: false })

  if (error) {
    console.log('LOAD DEBTS ERROR', error)
    errorMsg.value = error.message
    loading.value = false
    return
  }

  const rows = (data ?? []) as DebtRow[]

  const enriched = await Promise.all(
    rows.map(async (debt) => {
      const fromProfile = await $supabase
        .from('profiles')
        .select('name, surname')
        .eq('id', debt.from_user_id)
        .single()

      const toProfile = await $supabase
        .from('profiles')
        .select('name, surname')
        .eq('id', debt.to_user_id)
        .single()

      return {
        ...debt,
        from_name: fromProfile.data?.name,
        from_surname: fromProfile.data?.surname,
        to_name: toProfile.data?.name,
        to_surname: toProfile.data?.surname,
      }
    })
  )

  debts.value = enriched
  loading.value = false
}

async function markDebtAsSettled(debtId: string) {
  errorMsg.value = ''
  successMsg.value = ''

  const { error } = await $supabase
    .from('debts')
    .update({ settled: true })
    .eq('id', debtId)

  if (error) {
    console.log('SETTLE DEBT ERROR', error)
    errorMsg.value = error.message
    return
  }

  successMsg.value = 'Deuda marcada como saldada'
  await loadDebts()
}

onMounted(async () => {
  await loadDebts()
})
</script>

<template>
  <div>
    <AppNavbar />

    <div class="container py-5">
      <h1 class="mb-4">Deudas</h1>

      <div v-if="loading" class="alert alert-info">
        Cargando deudas...
      </div>

      <div v-else-if="errorMsg" class="alert alert-danger">
        {{ errorMsg }}
      </div>

      <div v-else>
        <div v-if="successMsg" class="alert alert-success">
          {{ successMsg }}
        </div>

        <div class="row g-4 mb-4">
          <div class="col-md-6">
            <div class="card shadow-sm h-100">
              <div class="card-body">
                <h4 class="mb-3">Te deben</h4>
                <p class="mb-0">
                  <strong>Total pendiente:</strong>
                  {{ pendingOwedToYouTotal.toFixed(2) }} €
                </p>
              </div>
            </div>
          </div>

          <div class="col-md-6">
            <div class="card shadow-sm h-100">
              <div class="card-body">
                <h4 class="mb-3">Debes</h4>
                <p class="mb-0">
                  <strong>Total pendiente:</strong>
                  {{ pendingYouOweTotal.toFixed(2) }} €
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="card shadow-sm mb-4">
          <div class="card-body">
            <h3 class="mb-3">Te deben</h3>

            <div v-if="debtsOwedToYou.length === 0" class="alert alert-secondary mb-0">
              Ahora mismo no te debe nada nadie.
            </div>

            <div
              v-for="debt in debtsOwedToYou"
              :key="debt.id"
              class="card border mb-3"
            >
              <div class="card-body">
                <p class="mb-1">
                  <strong>{{ debt.from_name }} {{ debt.from_surname }}</strong>
                  te debe
                  <strong>{{ Number(debt.amount).toFixed(2) }} €</strong>
                </p>

                <p class="mb-1" v-if="debt.reason">
                  <strong>Motivo:</strong> {{ debt.reason }}
                </p>

                <p class="mb-3">
                  <strong>Estado:</strong>
                  <span
                    class="badge"
                    :class="debt.settled ? 'text-bg-success' : 'text-bg-warning'"
                  >
                    {{ debt.settled ? 'Saldada' : 'Pendiente' }}
                  </span>
                </p>

                <button
                  v-if="!debt.settled"
                  class="btn btn-sm btn-success"
                  @click="markDebtAsSettled(debt.id)"
                >
                  Marcar como saldada
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="card shadow-sm">
          <div class="card-body">
            <h3 class="mb-3">Debes</h3>

            <div v-if="debtsYouOwe.length === 0" class="alert alert-secondary mb-0">
              No debes dinero a nadie.
            </div>

            <div
              v-for="debt in debtsYouOwe"
              :key="debt.id"
              class="card border mb-3"
            >
              <div class="card-body">
                <p class="mb-1">
                  Debes a
                  <strong>{{ debt.to_name }} {{ debt.to_surname }}</strong>
                  <strong>{{ Number(debt.amount).toFixed(2) }} €</strong>
                </p>

                <p class="mb-1" v-if="debt.reason">
                  <strong>Motivo:</strong> {{ debt.reason }}
                </p>

                <p class="mb-3">
                  <strong>Estado:</strong>
                  <span
                    class="badge"
                    :class="debt.settled ? 'text-bg-success' : 'text-bg-warning'"
                  >
                    {{ debt.settled ? 'Saldada' : 'Pendiente' }}
                  </span>
                </p>

                <button
                  v-if="!debt.settled"
                  class="btn btn-sm btn-success"
                  @click="markDebtAsSettled(debt.id)"
                >
                  Marcar como saldada
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>