import type { User } from "./api";

// Who is logged in while the app is open.
// Logging out = clearing the token.
export const session: { token: string; user: User | null } = {
  token: "",
  user: null,
};

// The mobile app is the Botanists' field tool; Officers and Admins use the website.
export function isBotanist(user: User | null) {
  return !!user && user.role_name === "Botanist";
}

export function isExternal(user: User | null) {
  return isBotanist(user) && user!.botanist_type === "External";
}

export function logout() {
  session.token = "";
  session.user = null;
}

// "Internal Botanist", "Conservation Officer", ...
export function roleLabel(user: User | null) {
  if (!user) return "";
  if (user.role_name === "Botanist" && user.botanist_type) return `${user.botanist_type} Botanist`;
  return user.role_name;
}
