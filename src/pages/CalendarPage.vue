<template>
  <div class="calendar-page">
    <header class="top-bar">
      <h2>Cat Roster</h2>

      <button class="create-btn" @click="logout">Exit</button>
    </header>

    <section class="progress-strip">
      <button class="progress-header profile-trigger" type="button" @click="openProfileEditor">
        <img
          class="progress-avatar"
          :src="resolveProfilePic(currentUser.profilePic)"
          :alt="`${currentUser.name} profile picture`"
        />
        <div>
          <p class="progress-label">Current duty tracker</p>
          <h3>{{ currentUser.name }}</h3>
          <p class="profile-hint">Tap to edit name, PIN and colour</p>
        </div>
      </button>

      <div class="progress-metrics">
        <article class="progress-metric">
          <span>Consecutive days</span>
          <strong>{{ currentUser.consecutiveDutyDays }}</strong>
        </article>

        <article class="progress-metric">
          <span>Completion cycle</span>
          <strong>{{ currentUser.completionCycle }}</strong>
        </article>

        <article class="progress-metric">
          <span>Days left</span>
          <strong>{{ currentUser.daysLeft }}</strong>
        </article>
      </div>
    </section>

    <div class="calendar-controls">
      <div class="year-header">
        <h3>{{ year }}</h3>
      </div>

      <label class="month-picker">
        <span>Month</span>
        <select v-model="selectedMonthIndex">
          <option
            v-for="month in monthOptions"
            :key="month.value"
            :value="month.value"
          >
            {{ month.label }}
          </option>
        </select>
      </label>
    </div>

    <section class="month-card">
      <h4>{{ selectedMonth.label }}</h4>

      <div class="weekday-row">
        <span v-for="weekday in weekdays" :key="weekday">
          {{ weekday }}
        </span>
      </div>

      <div class="calendar-grid">
        <div
          v-for="blank in selectedMonth.leadingBlanks"
          :key="`${selectedMonth.label}-blank-${blank}`"
          class="day-card placeholder"
          aria-hidden="true"
        />

        <button
          v-for="day in selectedMonth.days"
          :key="day.date"
          class="day-card"
          :class="getDutyCardClass(day.date)"
          :style="getDutyCardStyle(day.date)"
          @click="openChecklist(day.date)"
        >
          <strong>{{ day.day }}</strong>
          <span v-if="rosterState.duties[day.date] || rosterState.plans[day.date]">
            {{ rosterState.duties[day.date]?.profileName ?? rosterState.plans[day.date]?.profileName }}
          </span>
        </button>
      </div>
    </section>

    <div v-if="selectedDate" class="modal-backdrop">
      <div class="modal">
        <h3>{{ selectedDate }}</h3>

        <label v-for="task in tasks" :key="task" class="task">
          <input v-model="checkedTasks" type="checkbox" :value="task" />
          {{ task }}
        </label>

        <button class="submit-btn" :disabled="rosterState.submittingDuty" @click="submitDuty">
          {{ rosterState.submittingDuty ? "Saving..." : "comeplete task" }}
        </button>

        <button
          v-if="canBookWholeWeek"
          class="secondary-btn"
          :disabled="rosterState.submittingDuty"
          @click="handleBookWholeWeek"
        >
          {{ rosterState.submittingDuty ? "Saving..." : "book for the week" }}
        </button>

        <button
          v-else-if="canUnbookWholeWeek"
          class="secondary-btn"
          :disabled="rosterState.submittingDuty"
          @click="handleUnbookWholeWeek"
        >
          {{ rosterState.submittingDuty ? "Saving..." : "unbook for the week" }}
        </button>

        <p v-else-if="selectedMondayPlan" class="booking-note">
          booked by {{ selectedMondayPlan.profileName }}
        </p>

        <button
          class="cancel-btn"
          @click="
            selectedDate = null;
          "
        >
          Cancel
        </button>
      </div>
    </div>

    <div v-if="isEditingProfile" class="modal-backdrop" @click.self="closeProfileEditor">
      <div class="modal">
        <h3>Edit Profile</h3>

        <form class="profile-form" @submit.prevent="saveProfile">
          <label class="field">
            <span>Name</span>
            <input
              v-model="profileForm.name"
              type="text"
              maxlength="40"
              autocomplete="name"
              placeholder="Enter name"
            />
          </label>

          <label class="field">
            <span>4-digit PIN</span>
            <input
              v-model="profileForm.password"
              type="password"
              inputmode="numeric"
              maxlength="4"
              autocomplete="one-time-code"
              placeholder="0000"
              @input="handleProfilePinInput"
            />
          </label>

          <label class="field">
            <span>Completion colour</span>
            <div class="color-field">
              <input
                v-model="profileForm.completionColor"
                class="color-picker"
                type="color"
              />
              <span class="color-value">{{ profileForm.completionColor }}</span>
            </div>
          </label>

          <p v-if="profileError" class="page-error modal-error">{{ profileError }}</p>

          <button class="submit-btn" type="submit" :disabled="rosterState.savingProfile">
            {{ rosterState.savingProfile ? "Saving..." : "Save Profile" }}
          </button>

          <button class="cancel-btn" type="button" @click="closeProfileEditor">
            Cancel
          </button>
        </form>
      </div>
    </div>

    <p v-if="rosterState.error" class="page-error">{{ rosterState.error }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { resolveProfilePic } from "../data/profilePicMap";
import {
  bookWeekPlan,
  clearSelectedProfile,
  completeDuty,
  rosterState,
  unbookWeekPlan,
  updateSelectedProfile,
} from "../lib/rosterState";

const selectedDate = ref(null);
const checkedTasks = ref([]);
const isEditingProfile = ref(false);
const profileForm = ref({
  name: "",
  password: "",
  completionColor: "#f97316",
});
const profileError = ref("");
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const currentUser = computed(() => rosterState.selectedProfile);
const selectedMonthIndex = ref(new Date().getMonth());

const year = computed(() => {
  const now = new Date();
  return now.getFullYear();
});

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

const months = computed(() =>
  Array.from({ length: 12 }, (_, monthIndex) => {
    const firstDay = new Date(year.value, monthIndex, 1);
    const totalDays = new Date(year.value, monthIndex + 1, 0).getDate();

    return {
      label: monthFormatter.format(firstDay),
      leadingBlanks: firstDay.getDay(),
      days: Array.from({ length: totalDays }, (_, dayIndex) => {
        const day = dayIndex + 1;
        const date = `${year.value}-${String(monthIndex + 1).padStart(2, "0")}-${String(
          day
        ).padStart(2, "0")}`;

        return { day, date };
      }),
    };
  })
);

const monthOptions = computed(() =>
  months.value.map((month, index) => ({
    label: month.label,
    value: index,
  }))
);

const selectedMonth = computed(() => months.value[selectedMonthIndex.value]);

const tasks = computed(() => {
  const defaultTasks = ["Clean cat shit", "Clean cat bowls"];

  if (!currentUser.value) {
    return defaultTasks;
  }

  if (currentUser.value.daysLeft === 1) {
    return [...defaultTasks, "Refill cat tank", "Refill litter"];
  }

  return defaultTasks;
});

const getDutyCardStyle = (date) => {
  const duty = rosterState.duties[date];
  const plan = rosterState.plans[date];

  if (!duty && !plan) {
    return undefined;
  }

  const profileId = duty?.profileId ?? plan?.profileId;
  const profile = rosterState.profiles.find((entry) => entry.id === profileId);

  if (!profile?.completionColor) {
    return undefined;
  }

  if (duty) {
    return { backgroundColor: profile.completionColor };
  }

  return {
    borderColor: profile.completionColor,
    boxShadow: `inset 0 0 0 2px ${profile.completionColor}`,
    backgroundColor: `${profile.completionColor}22`,
  };
};

const getDutyCardClass = (date) => ({
  completed: !!rosterState.duties[date],
  planned: !rosterState.duties[date] && !!rosterState.plans[date],
});

const isMonday = computed(() => {
  if (!selectedDate.value) {
    return false;
  }

  const [year, month, day] = selectedDate.value.split("-").map(Number);
  return new Date(year, month - 1, day).getDay() === 1;
});

const canBookWholeWeek = computed(() => {
  if (!selectedDate.value || !isMonday.value) {
    return false;
  }

  return !rosterState.duties[selectedDate.value]?.completed && !rosterState.plans[selectedDate.value];
});

const selectedMondayPlan = computed(() => {
  if (!selectedDate.value || !isMonday.value) {
    return null;
  }

  const plan = rosterState.plans[selectedDate.value];

  if (!plan || plan.startDate !== selectedDate.value) {
    return null;
  }

  return plan;
});

const canUnbookWholeWeek = computed(
  () =>
    !!selectedMondayPlan.value &&
    selectedMondayPlan.value.profileId === currentUser.value?.id
);

const openChecklist = (date) => {
  if (rosterState.duties[date]?.completed) {
    return;
  }

  selectedDate.value = date;
  checkedTasks.value = [];
};

const openProfileEditor = () => {
  if (!currentUser.value) {
    return;
  }

  selectedDate.value = null;
  profileForm.value = {
    name: currentUser.value.name,
    password: String(currentUser.value.password ?? ""),
    completionColor: currentUser.value.completionColor ?? "#f97316",
  };
  profileError.value = "";
  isEditingProfile.value = true;
};

const closeProfileEditor = () => {
  isEditingProfile.value = false;
  profileError.value = "";
};

const handleProfilePinInput = () => {
  profileForm.value.password = profileForm.value.password.replace(/\D/g, "").slice(0, 4);
  profileError.value = "";
};

const saveProfile = async () => {
  const trimmedName = profileForm.value.name.trim();

  if (!trimmedName) {
    profileError.value = "Name is required.";
    return;
  }

  if (!/^\d{4}$/.test(profileForm.value.password)) {
    profileError.value = "PIN must be exactly 4 digits.";
    return;
  }

  profileError.value = "";

  const updated = await updateSelectedProfile({
    name: trimmedName,
    password: profileForm.value.password,
    completionColor: profileForm.value.completionColor,
  });

  if (updated) {
    closeProfileEditor();
  }
};

const logout = () => {
  selectedDate.value = null;
  closeProfileEditor();
  clearSelectedProfile();
};

const handleBookWholeWeek = async () => {
  if (!selectedDate.value || !canBookWholeWeek.value) {
    return;
  }

  const booked = await bookWeekPlan(selectedDate.value);

  if (booked) {
    selectedDate.value = null;
  }
};

const handleUnbookWholeWeek = async () => {
  if (!selectedDate.value || !canUnbookWholeWeek.value) {
    return;
  }

  const unbooked = await unbookWeekPlan(selectedDate.value);

  if (unbooked) {
    selectedDate.value = null;
  }
};

const submitDuty = async () => {

  if (checkedTasks.value.length !== tasks.value.length) {
    alert("Please complete all tasks first.");
    return;
  }

  const completed = await completeDuty(selectedDate.value);

  if (completed) {
    selectedDate.value = null;
  }
};
</script>

<style scoped>
.calendar-page {
  min-height: 100vh;
  padding: 16px;
  background: #fff7ed;
}

.top-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 48px;
}

.top-bar h2 {
  margin: 0;
  text-align: center;
}

.create-btn {
  position: absolute;
  right: 0;
  min-width: 48px;
  height: 48px;
  border: none;
  border-radius: 999px;
  padding: 0 14px;
  background: white;
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.progress-strip {
  margin-top: 16px;
  padding: 16px;
  border-radius: 20px;
  background: linear-gradient(135deg, #ffffff 0%, #ffedd5 100%);
  box-shadow: 0 12px 24px rgba(249, 115, 22, 0.12);
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-trigger {
  width: 100%;
  border: none;
  padding: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.progress-header h3 {
  margin: 4px 0 0;
}

.progress-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.95);
}

.progress-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #9a3412;
}

.profile-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #7c6f64;
}

.progress-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
}

.progress-metric {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
}

.progress-metric span {
  display: block;
  font-size: 12px;
  color: #7c6f64;
}

.progress-metric strong {
  display: block;
  margin-top: 6px;
  font-size: 22px;
  color: #431407;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
}

.calendar-controls {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}

.year-header {
  margin-top: 0;
}

.year-header h3 {
  margin: 0;
}

.month-picker {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #7c6f64;
}

.month-picker select {
  min-width: 140px;
  border: none;
  border-radius: 12px;
  padding: 10px 12px;
  background: white;
  font-size: 14px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.month-card {
  margin-top: 16px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.8);
}

.month-card h4 {
  margin: 0 0 10px;
}

.weekday-row {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 6px;
  margin-bottom: 6px;
}

.weekday-row span {
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: #7c6f64;
}

.day-card {
  min-height: 70px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  text-align: left;
}

.day-card.completed {
  color: white;
}

.day-card.planned {
  color: #431407;
}

.day-card.placeholder {
  visibility: hidden;
  pointer-events: none;
}

.day-card span {
  font-size: 11px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: grid;
  place-items: center;
}

.modal {
  width: 85%;
  max-width: 360px;
  padding: 20px;
  border-radius: 20px;
  background: white;
  box-sizing: border-box;
}

.task {
  display: block;
  margin: 14px 0;
}

.profile-form {
  margin-top: 16px;
}

.field {
  display: block;
  margin-top: 14px;
}

.field span {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #7c6f64;
}

.field input {
  width: 100%;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 16px;
  box-sizing: border-box;
}

.color-field {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-picker {
  width: 56px !important;
  min-width: 56px;
  height: 44px;
  border: 1px solid #fed7aa;
  border-radius: 14px;
  padding: 4px !important;
  background: white;
  cursor: pointer;
}

.color-value {
  font-size: 14px;
  font-weight: 600;
  color: #7c6f64;
  text-transform: uppercase;
}

.modal-error {
  margin-bottom: 0;
}

.submit-btn,
.secondary-btn,
.cancel-btn {
  width: 100%;
  border: none;
  border-radius: 14px;
  padding: 12px;
  margin-top: 10px;
  font-size: 16px;
}

.submit-btn {
  background: #f97316;
  color: white;
}

.secondary-btn {
  background: #ffedd5;
  color: #9a3412;
}

.cancel-btn {
  background: #eee;
}

.booking-note {
  margin: 10px 0 0;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: #9a3412;
}

.submit-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.7;
}

.page-error {
  margin-top: 16px;
  color: #b91c1c;
  text-align: center;
}

@media (max-width: 640px) {
  .progress-metrics {
    grid-template-columns: 1fr;
  }

  .calendar-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .month-picker select {
    width: 100%;
  }
}
</style>
