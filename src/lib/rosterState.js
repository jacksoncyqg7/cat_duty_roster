import { reactive } from "vue";
import { supabase } from "./supabaseClient";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_CYCLE_DAYS = 7;
const SELECTED_PROFILE_STORAGE_KEY = "catDutyRoster:selectedProfileId";
const supabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

const createDefaultState = () => ({
  profiles: [],
  duties: {},
  plans: {},
  selectedProfile: null,
  loading: false,
  submittingDuty: false,
  savingProfile: false,
  error: "",
});

export const rosterState = reactive(createDefaultState());

const readStoredSelectedProfileId = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(SELECTED_PROFILE_STORAGE_KEY);
};

const persistSelectedProfileId = (profileId) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!profileId) {
    window.localStorage.removeItem(SELECTED_PROFILE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SELECTED_PROFILE_STORAGE_KEY, profileId);
};

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

const getNextDate = (date) => {
  const next = new Date(toUtcDate(date) + MS_PER_DAY);

  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(
    next.getUTCDate()
  ).padStart(2, "0")}`;
};

const getDateRange = (startDate, endDate) => {
  const dates = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    dates.push(currentDate);
    currentDate = getNextDate(currentDate);
  }

  return dates;
};

const getWeekEndDate = (startDate) => {
  let date = startDate;

  for (let index = 0; index < 6; index += 1) {
    date = getNextDate(date);
  }

  return date;
};

const getWrappedConsecutiveDutyDays = (dutyDays, maxDutyDays = DEFAULT_CYCLE_DAYS) =>
  ((dutyDays - 1) % maxDutyDays) + 1;

const mapProfile = (profile) => ({
  id: profile.id,
  name: profile.name,
  profilePic: profile.profilepic,
  password: profile.password,
  completionColor: profile.completion_color,
  consecutiveDutyDays: profile.consecutive_duty_days,
  daysLeft: profile.days_left,
  completionCycle: profile.completion_cycle,
});

const mapDutyByDate = (duties, profiles) =>
  duties.reduce((accumulator, duty) => {
    const profile = profiles.find((entry) => entry.id === duty.user_id);

    accumulator[duty.duty_date] = {
      id: duty.id,
      profileId: duty.user_id,
      profileName: profile?.name ?? "Unknown",
      completed: duty.iscompleted,
    };

    return accumulator;
  }, {});

const mapPlansByDate = (plans, profiles) =>
  plans.reduce((accumulator, plan) => {
    const profile = profiles.find((entry) => entry.id === plan.user_id);

    for (const date of getDateRange(plan.start_date, plan.completion_date)) {
      accumulator[date] = {
        id: plan.id,
        profileId: plan.user_id,
        profileName: profile?.name ?? "Unknown",
        startDate: plan.start_date,
        completionDate: plan.completion_date,
      };
    }

    return accumulator;
  }, {});

const syncSelectedProfile = () => {
  if (!rosterState.selectedProfile) {
    const storedProfileId = readStoredSelectedProfileId();

    if (storedProfileId) {
      rosterState.selectedProfile =
        rosterState.profiles.find((profile) => profile.id === storedProfileId) ?? null;
    }

    return;
  }

  rosterState.selectedProfile =
    rosterState.profiles.find(
      (profile) => profile.id === rosterState.selectedProfile.id
    ) ?? null;

  persistSelectedProfileId(rosterState.selectedProfile?.id ?? null);
};

const recalculateConsecutiveDutyDays = (profiles, dutiesByDate) => {
  const completedDuties = Object.entries(dutiesByDate)
    .filter(([, duty]) => duty?.completed && duty?.profileId)
    .sort(([leftDate], [rightDate]) => leftDate.localeCompare(rightDate));

  if (completedDuties.length === 0) {
    return profiles.map((profile) => ({
      ...profile,
      consecutiveDutyDays: 0,
    }));
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

  return profiles.map((profile) => ({
    ...profile,
    consecutiveDutyDays: getWrappedConsecutiveDutyDays(
      consecutiveDutyDays,
      DEFAULT_CYCLE_DAYS
    ),
  }));
};

const applyProfiles = (profiles) => {
  rosterState.profiles = profiles;
  syncSelectedProfile();
};

const upsertDutyIntoState = (date, profile) => {
  rosterState.duties = {
    ...rosterState.duties,
    [date]: {
      profileId: profile.id,
      profileName: profile.name,
      completed: true,
    },
  };
};

const getLatestCompletedOwnPlannedDutyDate = (profileId, completedDate) => {
  const completedOwnPlannedDates = Object.entries(rosterState.duties)
    .filter(([dutyDate, duty]) => {
      if (!duty?.completed || duty.profileId !== profileId || dutyDate >= completedDate) {
        return false;
      }

      return rosterState.plans[dutyDate]?.profileId === profileId;
    })
    .map(([dutyDate]) => dutyDate)
    .sort((leftDate, rightDate) => leftDate.localeCompare(rightDate));

  return completedOwnPlannedDates.at(-1) ?? null;
};

const hasUnfulfilledOwnPlannedDutyGap = (profileId, startDate, endDate) => {
  let currentDate = getNextDate(startDate);

  while (currentDate < endDate) {
    const isOwnPlannedDuty = rosterState.plans[currentDate]?.profileId === profileId;
    const isDutyCompleted = !!rosterState.duties[currentDate]?.completed;

    if (isOwnPlannedDuty && !isDutyCompleted) {
      return true;
    }

    currentDate = getNextDate(currentDate);
  }

  return false;
};

export const loadRoster = async () => {
  if (rosterState.loading) {
    return;
  }

  rosterState.loading = true;
  rosterState.error = "";

  if (!supabaseConfigured || !supabase) {
    rosterState.loading = false;
    rosterState.error = "Supabase environment variables are missing.";
    return;
  }

  const [
    { data: profileRows, error: profileError },
    { data: dutyRows, error: dutyError },
    { data: planRows, error: planError },
  ] =
    await Promise.all([
      supabase.from("roster").select("*").order("name"),
      supabase.from("duties").select("*").eq("iscompleted", true),
      supabase.from("plans").select("*"),
    ]);

  if (profileError || dutyError || planError) {
    rosterState.loading = false;
    rosterState.error =
      profileError?.message ??
      dutyError?.message ??
      planError?.message ??
      "Failed to load roster.";
    return;
  }

  const profiles = Array.isArray(profileRows) ? profileRows.map(mapProfile) : [];
  const duties = Array.isArray(dutyRows) ? mapDutyByDate(dutyRows, profiles) : {};
  const plans = Array.isArray(planRows) ? mapPlansByDate(planRows, profiles) : {};

  applyProfiles(recalculateConsecutiveDutyDays(profiles, duties));
  rosterState.duties = duties;
  rosterState.plans = plans;
  rosterState.loading = false;
};

export const selectProfile = (profile) => {
  rosterState.selectedProfile = profile;
  persistSelectedProfileId(profile?.id ?? null);
};

export const clearSelectedProfile = () => {
  rosterState.selectedProfile = null;
  persistSelectedProfileId(null);
};

const persistProfileMetrics = async (profiles) => {
  for (const profile of profiles) {
    const { error } = await supabase
      .from("roster")
      .update({
        consecutive_duty_days: profile.consecutiveDutyDays,
        days_left: profile.daysLeft,
        completion_cycle: profile.completionCycle,
      })
      .eq("id", profile.id);

    if (error) {
      throw error;
    }
  }
};

export const completeDuty = async (date) => {
  if (!rosterState.selectedProfile || rosterState.submittingDuty) {
    return false;
  }

  if (rosterState.duties[date]?.completed) {
    return false;
  }

  rosterState.submittingDuty = true;
  rosterState.error = "";

  try {
    const { data: existingDuties, error: existingDutyError } = await supabase
      .from("duties")
      .select("id, iscompleted")
      .eq("duty_date", date)
      .limit(1);

    if (existingDutyError) {
      throw existingDutyError;
    }

    const existingDuty = existingDuties?.[0];

    if (existingDuty?.iscompleted) {
      await loadRoster();
      return false;
    }

    const user = rosterState.profiles.find(
      (profile) => profile.id === rosterState.selectedProfile.id
    );

    if (!user) {
      return false;
    }

    const isOwnPlannedDuty = rosterState.plans[date]?.profileId === user.id;
    const latestCompletedOwnPlannedDutyDate = getLatestCompletedOwnPlannedDutyDate(
      user.id,
      date
    );
    const streakResetCompensation =
      isOwnPlannedDuty &&
      latestCompletedOwnPlannedDutyDate &&
      hasUnfulfilledOwnPlannedDutyGap(
        user.id,
        latestCompletedOwnPlannedDutyDate,
        date
      )
        ? 1
        : 0;

    const updatedUser = {
      ...user,
      daysLeft: user.daysLeft - 1 + streakResetCompensation,
      completionCycle: user.completionCycle,
    };

    if (updatedUser.daysLeft <= 0) {
      updatedUser.completionCycle += 1;
      updatedUser.daysLeft = DEFAULT_CYCLE_DAYS;
    }

    if (updatedUser.daysLeft > DEFAULT_CYCLE_DAYS) {
      updatedUser.daysLeft = DEFAULT_CYCLE_DAYS;
    }

    if (existingDuty?.id) {
      const { error: updateDutyError } = await supabase
        .from("duties")
        .update({
          user_id: updatedUser.id,
          iscompleted: true,
        })
        .eq("id", existingDuty.id);

      if (updateDutyError) {
        throw updateDutyError;
      }
    } else {
      const { error: insertDutyError } = await supabase.from("duties").insert({
        user_id: updatedUser.id,
        duty_date: date,
        iscompleted: true,
      });

      if (insertDutyError) {
        throw insertDutyError;
      }
    }

    const nextProfiles = recalculateConsecutiveDutyDays(
      rosterState.profiles.map((profile) =>
        profile.id === updatedUser.id ? updatedUser : profile
      ),
      {
        ...rosterState.duties,
        [date]: {
          profileId: updatedUser.id,
          profileName: updatedUser.name,
          completed: true,
        },
      }
    );

    await persistProfileMetrics(nextProfiles);
    applyProfiles(nextProfiles);
    upsertDutyIntoState(date, updatedUser);
  } catch (error) {
    rosterState.error = error.message ?? "Failed to complete duty.";
    return false;
  } finally {
    rosterState.submittingDuty = false;
    syncSelectedProfile();
  }

  return true;
};

export const bookWeekPlan = async (startDate) => {
  if (!rosterState.selectedProfile || rosterState.submittingDuty) {
    return false;
  }

  rosterState.submittingDuty = true;
  rosterState.error = "";

  const endDate = getWeekEndDate(startDate);
  const plannedDates = getDateRange(startDate, endDate);

  const hasConflict = plannedDates.some(
    (date) => rosterState.duties[date]?.completed || rosterState.plans[date]
  );

  if (hasConflict) {
    rosterState.error = "This week already has a planned or completed duty.";
    return false;
  }

  try {
    const { data: existingPlans, error: existingPlanError } = await supabase
      .from("plans")
      .select("id")
      .eq("start_date", startDate)
      .limit(1);

    if (existingPlanError) {
      throw existingPlanError;
    }

    const planPayload = {
      user_id: rosterState.selectedProfile.id,
      start_date: startDate,
      completion_date: endDate,
    };

    if (existingPlans?.[0]?.id) {
      const { error: updatePlanError } = await supabase
        .from("plans")
        .update(planPayload)
        .eq("id", existingPlans[0].id);

      if (updatePlanError) {
        throw updatePlanError;
      }
    } else {
      const { error: insertPlanError } = await supabase.from("plans").insert(planPayload);

      if (insertPlanError) {
        throw insertPlanError;
      }
    }

    const nextPlans = { ...rosterState.plans };
    for (const date of plannedDates) {
      nextPlans[date] = {
        profileId: rosterState.selectedProfile.id,
        profileName: rosterState.selectedProfile.name,
        startDate,
        completionDate: endDate,
      };
    }
    rosterState.plans = nextPlans;
  } catch (error) {
    rosterState.error = error.message ?? "Failed to book week.";
    return false;
  } finally {
    rosterState.submittingDuty = false;
    syncSelectedProfile();
  }

  return true;
};

export const unbookWeekPlan = async (startDate) => {
  if (!rosterState.selectedProfile || rosterState.submittingDuty) {
    return false;
  }

  const mondayPlan = rosterState.plans[startDate];

  if (!mondayPlan || mondayPlan.startDate !== startDate) {
    rosterState.error = "No weekly plan starts on this date.";
    return false;
  }

  if (mondayPlan.profileId !== rosterState.selectedProfile.id) {
    rosterState.error = "Only the roster who booked this week can unreserve it.";
    return false;
  }

  rosterState.submittingDuty = true;
  rosterState.error = "";

  try {
    const { error } = await supabase
      .from("plans")
      .delete()
      .eq("user_id", rosterState.selectedProfile.id)
      .eq("start_date", startDate)
      .eq("completion_date", mondayPlan.completionDate);

    if (error) {
      throw error;
    }

    const nextPlans = { ...rosterState.plans };

    for (const date of getDateRange(startDate, mondayPlan.completionDate)) {
      delete nextPlans[date];
    }

    rosterState.plans = nextPlans;
  } catch (error) {
    rosterState.error = error.message ?? "Failed to unreserve week.";
    return false;
  } finally {
    rosterState.submittingDuty = false;
    syncSelectedProfile();
  }

  return true;
};

export const updateSelectedProfile = async ({ name, password, completionColor }) => {
  if (!rosterState.selectedProfile) {
    rosterState.error = "No profile selected.";
    return false;
  }

  rosterState.savingProfile = true;
  rosterState.error = "";

  const profileId = rosterState.selectedProfile.id;

  const { data, error } = await supabase
    .from("roster")
    .update({
      name,
      password,
      completion_color: completionColor,
    })
    .eq("id", profileId)
    .select();

  rosterState.savingProfile = false;

  if (error) {
    rosterState.error = error.message;
    return false;
  }

  if (!data || data.length === 0) {
    rosterState.error = "No database row was updated. Check profile ID or RLS policy.";
    return false;
  }

  const updatedRow = data[0];

  rosterState.profiles = rosterState.profiles.map((profile) =>
    profile.id === profileId
      ? {
          ...profile,
          name: updatedRow.name,
          password: updatedRow.password,
          completionColor: updatedRow.completion_color,
        }
      : profile
  );

  rosterState.selectedProfile =
    rosterState.profiles.find((profile) => profile.id === profileId) ?? null;

  return true;
};
