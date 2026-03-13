<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
    <div class="container">
      <NuxtLink to="/home" class="navbar-brand fw-bold">PartyBet</NuxtLink>

      <div class="navbar-nav ms-auto">
        <NuxtLink to="/home" class="nav-link">Inicio</NuxtLink>
        <NuxtLink to="/crear-apuesta" class="nav-link">Crear apuesta</NuxtLink>
        <NuxtLink to="/apostar" class="nav-link">Apostar</NuxtLink>
        <NuxtLink to="/deudas" class="nav-link">Deudas</NuxtLink>
        <NuxtLink to="/perfil" class="nav-link">Perfil</NuxtLink>
      </div>
    </div>
  </nav>
</template>