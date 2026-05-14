<template>
  <div class="calendar-page">
    <header class="top-bar">
      <h2>Cat Roster</h2>

      <button class="create-btn" @click="logout">Exit</button>
    </header>

    <section class="progress-strip">
      <div class="progress-header">
        <img
          class="progress-avatar"
          :src="currentUser.profilePic"
          :alt="`${currentUser.name} profile picture`"
        />
        <div>
          <p class="progress-label">Current duty tracker</p>
          <h3>{{ currentUser.name }}</h3>
        </div>
      </div>

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
