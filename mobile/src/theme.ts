export const C = {
  bg: "#F7F5EF", green: "#1F4D3A", orange: "#C97B3D",
  text: "#1B1B18", muted: "#6B6B63", faint: "#9A968A",
  border: "#D8D4C8", line: "#EDEAE0",
  greenSoft: "#EAF2EC", orangeSoft: "#FBEFE3",
  dark: "#12211A", white: "#FFFFFF",
};

export const F = {
  title: "Fraunces_700Bold",
  body: "SourceSans3_400Regular",
  semi: "SourceSans3_600SemiBold",
};

// "Today, 9:42 AM" / "Yesterday, 4:20 PM" / "3 days ago"
export function friendlyDate(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(d)) / 86400000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  return `${days} days ago`;
}