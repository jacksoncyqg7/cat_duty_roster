import { reactive } from "vue";
import { profiles } from "../data/profile";

const STORAGE_VERSION = 8;

const createDefaultState = () => ({
  storageVersion: STORAGE_VERSION,
  selectedProfile: null,
  profiles: profiles.map((profile) => ({ ...profile })),
  duties: {},
});

const defaultCycleDaysByProfileId = Object.fromEntries(
  profiles.map((profile) => [profile.id, profile.daysLeft])
);

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getDateParts = (date) => date.split("-").map(Number);

const toUtcDate = (date) => {
  const [year, month, day] = getDateParts(date);
  return Date.UTC(year, month - 1, day);
};

const getPreviousDate = (date) => {
  const previous = new Date(toUtcDate(date) - MS_PER_DAY);

  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, "0")}-${String(
    previous.getUTCDate()
  ).padStart(2, "0")}`;
};

const getWrappedConsecutiveDutyDays = (dutyDays, maxDutyDays = 7) =>
  ((dutyDays - 1) % maxDutyDays) + 1;

const recalculateConsecutiveDutyDays = (roster) => {
  const completedDuties = Object.entries(roster.duties)
    .filter(([, duty]) => duty?.completed && duty?.profileId)
    .sort();

  if (completedDuties.length === 0) {
    roster.profiles.forEach((profile) => {
      profile.consecutiveDutyDays = 0;
    });

    return;
  }

  let consecutiveDutyDays = 1;

  for (let index = 1; index < completedDuties.length; index += 1) {
    const [previousDate] = completedDuties[index - 1];
    const [currentDate] = completedDuties[index];

    consecutiveDutyDays =
      getPreviousDate(currentDate) === previousDate
        ? consecutiveDutyDays + 1
        : 1;
  }

  roster.profiles.forEach((profile) => {
    const maxDutyDays = defaultCycleDaysByProfileId[profile.id];
    profile.consecutiveDutyDays = getWrappedConsecutiveDutyDays(
      consecutiveDutyDays,
      typeof maxDutyDays === "number" ? maxDutyDays : 7
    );
  });
};

const mergeProfiles = (savedProfiles = []) =>
  profiles.map((defaultProfile) => {
    const savedProfile = savedProfiles.find(
      (profile) => profile.id === defaultProfile.id
    );

    if (!savedProfile) {
      return defaultProfile;
    }

    const normalizedDaysLeft =
      typeof savedProfile.daysLeft === "number"
        ? savedProfile.daysLeft
        : savedProfile.totalDutyDays;

    return {
      ...defaultProfile,
      ...savedProfile,
      daysLeft:
        typeof normalizedDaysLeft === "number"
          ? normalizedDaysLeft
          : defaultProfile.daysLeft,
      completionCycle:
        typeof savedProfile.completionCycle === "number"
          ? savedProfile.completionCycle
          : defaultProfile.completionCycle,
      profilePic: defaultProfile.profilePic,
    };
  });

const loadRoster = () => {
  const savedData = localStorage.getItem("catDutyRoster");

  if (!savedData) {
    return createDefaultState();
  }

  try {
    const parsed = JSON.parse(savedData);

    if (parsed.storageVersion !== STORAGE_VERSION) {
      localStorage.removeItem("catDutyRoster");
      return createDefaultState();
    }

    const defaultState = createDefaultState();

    const mergedProfiles = Array.isArray(parsed.profiles)
      ? mergeProfiles(parsed.profiles)
      : profiles;
    const selectedProfile = parsed.selectedProfile
      ? mergedProfiles.find((profile) => profile.id === parsed.selectedProfile.id) ?? null
      : null;

    const loadedState = {
      ...defaultState,
      ...parsed,
      selectedProfile,
      profiles: mergedProfiles,
      duties: parsed.duties && typeof parsed.duties === "object" ? parsed.duties : {},
    };

    recalculateConsecutiveDutyDays(loadedState);

    return loadedState;
  } catch {
    localStorage.removeItem("catDutyRoster");
    return createDefaultState();
  }
};

export const rosterStore = reactive(loadRoster());

export const saveRoster = () => {
  localStorage.setItem(
    "catDutyRoster",
    JSON.stringify({
      ...rosterStore,
      storageVersion: STORAGE_VERSION,
    })
  );
};

export const selectProfile = (profile) => {
  rosterStore.selectedProfile = profile;
  saveRoster();
};

export const clearSelectedProfile = () => {
  rosterStore.selectedProfile = null;
  saveRoster();
};

export const completeDuty = (date, tasks) => {
  if (!rosterStore.selectedProfile) return;

  if (rosterStore.duties[date]?.completed) {
    return;
  }

  const user = rosterStore.profiles.find(
    (p) => p.id === rosterStore.selectedProfile.id
  );

  if (!user) return;

  const maxDutyDays = defaultCycleDaysByProfileId[user.id];
  const resetDutyDays = typeof maxDutyDays === "number" ? maxDutyDays : 7;

  const previousDayCompleted = !!rosterStore.duties[getPreviousDate(date)]?.completed;
  const hasExistingCompletedDuty = Object.values(rosterStore.duties).some(
    (duty) => duty?.completed
  );
  const streakResetCompensation =
    hasExistingCompletedDuty && !previousDayCompleted ? 1 : 0;

  user.daysLeft = user.daysLeft - 1 + streakResetCompensation;

  if (user.daysLeft <= 0) {
    user.completionCycle += 1;
    user.daysLeft = resetDutyDays;
  }

  if (typeof maxDutyDays === "number" && user.daysLeft > maxDutyDays) {
    user.daysLeft = maxDutyDays;
  }

  rosterStore.duties[date] = {
    profileId: user.id,
    profileName: user.name,
    tasks,
    completed: true,
  };

  recalculateConsecutiveDutyDays(rosterStore);
  rosterStore.selectedProfile = user;

  saveRoster();
};
