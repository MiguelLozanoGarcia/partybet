<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

import { ref, onMounted } from 'vue'
import { useNuxtApp, useRoute, navigateTo } from '#imports'
import { useAuth } from '~/composables/useAuth'
import type { SupabaseClient } from '@supabase/supabase-js'

const route = useRoute()
const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }
const { user } = useAuth()

const loading = ref(true)
const resolving = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const bet = ref<any>(null)
const events = ref<any[]>([])

async function loadBet(){

 const { data, error } = await $supabase
 .from('bets')
 .select('*')
 .eq('id', route.params.id)
 .single()

 if(error){
  errorMsg.value = error.message
  return
 }

 bet.value = data

 // solo la banca puede resolver
 if (data.bank_user_id !== user.value?.id) {
  alert("Solo la banca puede resolver esta apuesta")
  navigateTo("/apuestas/" + data.id)
  return
 }

 // si ya está resuelta
 if(data.status === "resolved"){
  alert("Esta apuesta ya fue resuelta")
  navigateTo("/apuestas/" + data.id)
  return
 }
}

async function loadEvents(){

 const { data, error } = await $supabase
 .from('bet_events')
 .select(`
   id,
   result,
   template:event_templates(name)
 `)
 .eq('bet_id', route.params.id)

 if(error){
  errorMsg.value = error.message
  return
 }

 events.value = data ?? []
}

async function saveResult(eventId:string,result:string){

 await $supabase
 .from('bet_events')
 .update({ result })
 .eq('id',eventId)

}

async function resolveBet(){

 if(resolving.value) return

 if(bet.value.status === "resolved"){
  alert("Esta apuesta ya está resuelta")
  return
 }

 // comprobar eventos sin resolver
 const unresolved = events.value.find(e => !e.result)

 if(unresolved){
  alert("Debes resolver todos los eventos antes")
  return
 }

 resolving.value = true
 errorMsg.value = ''

 const { data:userBets } = await $supabase
 .from('user_bets')
 .select('*')
 .eq('bet_id',bet.value.id)

 for(const userBet of userBets ?? []){

  const { data:selections } = await $supabase
  .from('selections')
  .select('bet_event_id')
  .eq('user_bet_id',userBet.id)

  let win = true

  for(const sel of selections ?? []){

   const event = events.value.find(e=>e.id===sel.bet_event_id)

   if(!event || event.result !== 'win'){
    win = false
    break
   }

  }

  if(win){

   const profit = userBet.potential_win - userBet.stake

   await $supabase
   .from('debts')
   .insert({
    from_user_id: bet.value.bank_user_id,
    to_user_id: userBet.user_id,
    amount: profit,
    reason: bet.value.title
   })

  }
  else{

   await $supabase
   .from('debts')
   .insert({
    from_user_id: userBet.user_id,
    to_user_id: bet.value.bank_user_id,
    amount: userBet.stake,
    reason: bet.value.title
   })

  }

 }

 // marcar apuesta como resuelta
 const { error:updateError } = await $supabase
 .from('bets')
 .update({ status:'resolved' })
 .eq('id',bet.value.id)

 if(updateError){
  console.log(updateError)
  alert(updateError.message)
  resolving.value = false
  return
 }

 // actualizar frontend
 bet.value.status = "resolved"

 successMsg.value = "Apuesta resuelta correctamente"

 setTimeout(()=>{
  navigateTo("/deudas")
 },1200)

}

onMounted(async()=>{

 await loadBet()
 await loadEvents()

 loading.value = false

})
</script>

<template>

<div>

<AppNavbar/>

<div class="container py-5">

<h1 class="mb-4">
Resolver apuesta
</h1>

<div v-if="loading" class="alert alert-info">
Cargando...
</div>

<div v-if="errorMsg" class="alert alert-danger">
{{errorMsg}}
</div>

<div v-if="bet">

<h3 class="mb-3">
{{bet.title}}
</h3>

<div v-if="bet.status === 'resolved'" class="alert alert-success mt-2">
Esta apuesta ya ha sido resuelta.
</div>

<div
v-for="event in events"
:key="event.id"
class="card mb-3"
>

<div class="card-body">

<strong>
{{ event.template?.name }}
</strong>

<select
class="form-select mt-2"
v-model="event.result"
@change="saveResult(event.id,event.result)"
:disabled="bet.status === 'resolved'"
>

<option value="">Sin resolver</option>
<option value="win">Cumplido</option>
<option value="lose">No cumplido</option>

</select>

</div>

</div>

<button
class="btn btn-success"
@click="resolveBet"
:disabled="resolving || bet.status === 'resolved'"
>

{{ resolving ? "Resolviendo..." : "Resolver apuesta" }}

</button>

<div v-if="successMsg" class="alert alert-success mt-3">
{{successMsg}}
</div>

</div>

</div>

</div>

</template>