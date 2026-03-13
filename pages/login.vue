<script setup lang="ts">
import { ref } from 'vue'
import { useNuxtApp, navigateTo } from '#imports'
import type { SupabaseClient } from '@supabase/supabase-js'


definePageMeta({
  middleware: 'guest',
})

const { $supabase } = useNuxtApp() as { $supabase: SupabaseClient }

const isLogin = ref(false)

const email = ref('')
const password = ref('')
const name = ref('')
const surname = ref('')

const errorMsg = ref('')
const successMsg = ref('')

async function register() {
  errorMsg.value = ''
  successMsg.value = ''

  const { error } = await $supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: {
        name: name.value,
        surname: surname.value,
      },
    },
  })

  if (error) {
    errorMsg.value = error.message
    return
  }

  successMsg.value = 'Usuario creado correctamente. Ya puedes iniciar sesión.'
  isLogin.value = true
}

async function login() {
  errorMsg.value = ''
  successMsg.value = ''

  const { error } = await $supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })

  if (error) {
    errorMsg.value = error.message
    return
  }

  await navigateTo('/home')
}
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-12 col-md-8 col-lg-5">
        <div class="card shadow">
          <div class="card-body p-4">
            <h1 class="text-center mb-3">PartyBet</h1>
            <h3 class="text-center mb-4">{{ isLogin ? 'Iniciar sesión' : 'Registro' }}</h3>

            <div v-if="!isLogin" class="mb-3">
              <label class="form-label">Nombre</label>
              <input v-model="name" class="form-control" placeholder="Tu nombre" />
            </div>

            <div v-if="!isLogin" class="mb-3">
              <label class="form-label">Apellido</label>
              <input v-model="surname" class="form-control" placeholder="Tu apellido" />
            </div>

            <div class="mb-3">
              <label class="form-label">Email</label>
              <input v-model="email" type="email" class="form-control" placeholder="tu@email.com" />
            </div>

            <div class="mb-3">
              <label class="form-label">Password</label>
              <input v-model="password" type="password" class="form-control" placeholder="******" />
            </div>

            <button v-if="!isLogin" class="btn btn-primary w-100" @click="register">
              Registrarse
            </button>

            <button v-else class="btn btn-success w-100" @click="login">
              Iniciar sesión
            </button>

            <div v-if="errorMsg" class="alert alert-danger mt-3 mb-0">
              {{ errorMsg }}
            </div>

            <div v-if="successMsg" class="alert alert-success mt-3 mb-0">
              {{ successMsg }}
            </div>

            <p class="text-center mt-4 mb-0">
              <a href="#" @click.prevent="isLogin = !isLogin">
                {{ isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión' }}
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>