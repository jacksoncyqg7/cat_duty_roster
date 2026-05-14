<template>
  <LoginPage v-if="!rosterState.selectedProfile" />
  <CalendarPage v-else />
</template>

<script setup>
import LoginPage from "./pages/LoginPage.vue";
import CalendarPage from "./pages/CalendarPage.vue";
import { rosterState } from "./lib/rosterState";
</script>
