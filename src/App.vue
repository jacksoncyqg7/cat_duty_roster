<template>
  <LoginPage v-if="!rosterStore.selectedProfile" />
  <CalendarPage v-else />
</template>

<script setup>
import LoginPage from "./pages/LoginPage.vue";
import CalendarPage from "./pages/CalendarPage.vue";
import { rosterStore } from "./store/rosterStore";
</script>
