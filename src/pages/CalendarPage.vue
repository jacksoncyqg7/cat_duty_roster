<template>
  <div class="calendar-page">
    <header class="top-bar">
      <button class="profile-btn" @click="showProfile = true">
        <img
          class="profile-btn-image"
          :src="currentUser.profilePic"
          :alt="`${currentUser.name} profile picture`"
        />
      </button>

      <h2>Cat Roster</h2>

      <button class="create-btn" @click="logout">Exit</button>
    </header>

    <section v-if="showProfile" class="profile-panel">
      <button class="close-btn" @click="showProfile = false">x</button>
      <h3>{{ currentUser.name }}</h3>
      <p>Consecutive duty days: {{ currentUser.consecutiveDutyDays }}</p>
      <p>Completion cycle: {{ currentUser.completionCycle }}</p>
      <p>Days left: {{ currentUser.daysLeft }}</p>
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
          :class="{ completed: !!rosterStore.duties[day.date] }"
          :style="getDutyCardStyle(day.date)"
          @click="openChecklist(day.date)"
        >
          <strong>{{ day.day }}</strong>
          <span v-if="rosterStore.duties[day.date]">
            {{ rosterStore.duties[day.date].profileName }}
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

        <button class="submit-btn" @click="submitDuty">
          Complete Duty
        </button>

        <button class="cancel-btn" @click="selectedDate = null">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import {
  clearSelectedProfile,
  completeDuty,
  rosterStore,
} from "../store/rosterStore";

const selectedDate = ref(null);
const checkedTasks = ref([]);
const showProfile = ref(false);
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const currentUser = computed(() => rosterStore.selectedProfile);
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
  const duty = rosterStore.duties[date];

  if (!duty) {
    return undefined;
  }

  const profile = rosterStore.profiles.find((entry) => entry.id === duty.profileId);

  return profile?.completionColor
    ? { backgroundColor: profile.completionColor }
    : undefined;
};

const openChecklist = (date) => {
  if (rosterStore.duties[date]?.completed) {
    return;
  }

  selectedDate.value = date;
  checkedTasks.value = [];
};

const logout = () => {
  showProfile.value = false;
  selectedDate.value = null;
  clearSelectedProfile();
};

const submitDuty = () => {
  if (checkedTasks.value.length !== tasks.value.length) {
    alert("Please complete all tasks first.");
    return;
  }

  completeDuty(selectedDate.value, checkedTasks.value);
  selectedDate.value = null;
};
</script>

<style scoped>
.calendar-page {
  min-height: 100vh;
  padding: 16px;
  background: #fff7ed;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.top-bar h2 {
  margin: 0;
}

.profile-btn {
  width: 48px;
  height: 48px;
  padding: 0;
  overflow: hidden;
  border: none;
  border-radius: 50%;
  background: white;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.profile-btn-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.create-btn {
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

.profile-panel {
  position: relative;
  margin: 16px 0;
  padding: 16px;
  border-radius: 18px;
  background: white;
}

.close-btn {
  position: absolute;
  right: 12px;
  top: 8px;
  border: none;
  background: none;
  font-size: 24px;
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
  border: none;
  border-radius: 12px;
  background: white;
  font-size: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  text-align: left;
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
}

.task {
  display: block;
  margin: 14px 0;
}

.submit-btn,
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

.cancel-btn {
  background: #eee;
}

@media (max-width: 640px) {
  .calendar-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .month-picker select {
    width: 100%;
  }
}
</style>
