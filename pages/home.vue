<script setup lang="ts">
definePageMeta({
  middleware: 'auth',
})

import { useAuth } from '~/composables/useAuth'
import { navigateTo } from '#imports'

const { user, signOut } = useAuth()

async function logout() {
  await signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div>
    <AppNavbar />

    <div class="container py-5">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 class="mb-1">Bienvenido a PartyBet</h1>
          <p class="text-muted mb-0" v-if="user">{{ user.email }}</p>
        </div>

        <button class="btn btn-outline-danger" @click="logout">
          Cerrar sesión
        </button>
      </div>

      <div class="row g-4">
        <div class="col-md-6 col-lg-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Crear apuesta</h5>
              <p class="card-text">Conviértete en banca y monta la apuesta de la noche.</p>
              <NuxtLink to="/crear-apuesta" class="btn btn-primary">Entrar</NuxtLink>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Apostar</h5>
              <p class="card-text">Consulta apuestas abiertas y haz tu combinada.</p>
              <NuxtLink to="/apostar" class="btn btn-success">Entrar</NuxtLink>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Deudas</h5>
              <p class="card-text">Mira quién te debe y a quién debes dinero.</p>
              <NuxtLink to="/deudas" class="btn btn-warning">Entrar</NuxtLink>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-3">
          <div class="card h-100 shadow-sm">
            <div class="card-body">
              <h5 class="card-title">Perfil</h5>
              <p class="card-text">Consulta tu historial y tus estadísticas.</p>
              <NuxtLink to="/perfil" class="btn btn-dark">Entrar</NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>