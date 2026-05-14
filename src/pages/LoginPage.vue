<template>
  <div class="login-page">
    <h1>Cat Duty Roster</h1>
    <p>Select roster profile</p>

    <div class="profile-list">
      <button
        v-for="profile in rosterStore.profiles"
        :key="profile.id"
        class="profile-card"
        @click="handleSelect(profile)"
      >
        <img class="avatar" :src="profile.profilePic" :alt="`${profile.name} profile picture`" />
        <div>{{ profile.name }}</div>
      </button>
    </div>
  </div>
</template>

<script setup>
import { rosterStore, selectProfile } from "../store/rosterStore";

const emit = defineEmits(["login"]);

const handleSelect = (profile) => {
  selectProfile(profile);
  emit("login");
};
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  padding: 24px;
  text-align: center;
  background: #fff7ed;
}

.profile-list {
  display: grid;
  gap: 16px;
  margin-top: 24px;
}

.profile-card {
  border: none;
  border-radius: 18px;
  padding: 20px;
  background: white;
  font-size: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.avatar {
  width: 72px;
  height: 72px;
  margin-bottom: 8px;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
</style>
