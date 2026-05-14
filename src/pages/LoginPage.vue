<template>
  <div class="login-page">
    <h1>Cat Duty Roster</h1>
    <p>Select roster profile</p>

    <p v-if="rosterState.loading" class="status-message">Loading profiles...</p>

    <div v-else class="profile-list">
      <button
        v-for="profile in rosterState.profiles"
        :key="profile.id"
        class="profile-card"
        @click="handleSelect(profile)"
      >
        <img
          class="avatar"
          :src="resolveProfilePic(profile.profilePic)"
          :alt="`${profile.name} profile picture`"
        />
        <div>{{ profile.name }}</div>
      </button>
    </div>

    <div v-if="pendingProfile" class="modal-backdrop" @click.self="closePinPrompt">
      <div class="pin-modal">
        <img
          class="avatar"
          :src="resolveProfilePic(pendingProfile.profilePic)"
          :alt="`${pendingProfile.name} profile picture`"
        />
        <h2>{{ pendingProfile.name }}</h2>
        <p class="pin-copy">Enter 4-digit PIN</p>

        <form class="pin-form" @submit.prevent="submitPin">
          <input
            v-model="pinInput"
            class="pin-input"
            type="password"
            inputmode="numeric"
            maxlength="4"
            autocomplete="one-time-code"
            placeholder="••••"
            @input="handlePinInput"
          />

          <p v-if="pinError" class="error-message">{{ pinError }}</p>

          <button class="pin-submit" type="submit">Unlock</button>
          <button class="pin-cancel" type="button" @click="closePinPrompt">Cancel</button>
        </form>
      </div>
    </div>

    <p v-if="rosterState.error" class="error-message">{{ rosterState.error }}</p>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { resolveProfilePic } from "../data/profilePicMap";
import { loadRoster, rosterState, selectProfile } from "../lib/rosterState";

const pendingProfile = ref(null);
const pinInput = ref("");
const pinError = ref("");

onMounted(() => {
  loadRoster();
});

const handleSelect = (profile) => {
  pendingProfile.value = profile;
  pinInput.value = "";
  pinError.value = "";
};

const closePinPrompt = () => {
  pendingProfile.value = null;
  pinInput.value = "";
  pinError.value = "";
};

const normalizePin = (value) => String(value ?? "").trim();

const handlePinInput = () => {
  pinInput.value = pinInput.value.replace(/\D/g, "").slice(0, 4);
  pinError.value = "";
};

const submitPin = () => {
  if (!pendingProfile.value) {
    return;
  }

  if (!/^\d{4}$/.test(pinInput.value)) {
    pinError.value = "PIN must be exactly 4 digits.";
    return;
  }

  if (pinInput.value !== normalizePin(pendingProfile.value.password)) {
    pinError.value = "Incorrect PIN.";
    return;
  }

  selectProfile(pendingProfile.value);
  closePinPrompt();
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

.status-message {
  margin-top: 24px;
  color: #7c2d12;
  font-weight: 600;
}

.profile-card {
  border: none;
  border-radius: 18px;
  padding: 20px;
  background: white;
  font-size: 20px;
  cursor: pointer;
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

.error-message {
  margin-top: 16px;
  color: #b91c1c;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.38);
}

.pin-modal {
  width: min(100%, 360px);
  border-radius: 24px;
  padding: 24px;
  background: white;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.2);
  box-sizing: border-box;
}

.pin-modal h2 {
  margin: 0;
}

.pin-copy {
  margin: 8px 0 0;
  color: #7c2d12;
}

.pin-form {
  margin-top: 18px;
  display: grid;
  gap: 12px;
}

.pin-input {
  width: 100%;
  border: 2px solid #fdba74;
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 28px;
  text-align: center;
  letter-spacing: 0.35em;
  box-sizing: border-box;
}

.pin-submit,
.pin-cancel {
  width: 100%;
  border: none;
  border-radius: 16px;
  padding: 14px 16px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-sizing: border-box;
}

.pin-submit {
  background: #f97316;
  color: white;
}

.pin-cancel {
  background: #ffedd5;
  color: #9a3412;
}
</style>
