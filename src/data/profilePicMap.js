import rayquaza from "../assets/rayquaza.jpg";
import wumple from "../assets/wumple.jpg";
import cascoon from "../assets/cascoon.jpg";

export const profilePicMap = {
  rayquaza,
  wumple,
  cascoon,
};

const profilePicAliases = {
  rayquaza: "rayquaza",
  wumple: "wumple",
  wurmple: "wumple",
  cascoon: "cascoon",
};

const normalizeProfilePicKey = (profilePic) => {
  if (typeof profilePic !== "string") {
    return "";
  }

  const trimmedProfilePic = profilePic.trim().toLowerCase();

  if (!trimmedProfilePic) {
    return "";
  }

  const filename = trimmedProfilePic.split("/").pop()?.split("\\").pop() ?? "";
  return filename.replace(/\.[^.]+$/, "");
};

export const resolveProfilePic = (profilePic) => {
  const normalizedKey = normalizeProfilePicKey(profilePic);
  const resolvedKey = profilePicAliases[normalizedKey];

  if (resolvedKey) {
    return profilePicMap[resolvedKey];
  }

  if (typeof profilePic === "string" && /^https?:\/\//.test(profilePic.trim())) {
    return profilePic.trim();
  }

  return profilePicMap.rayquaza;
};
