import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { C, F } from "./theme";

// Plant status (Published / Under Research) or request status (Pending / Approved / Rejected)
const BADGES: Record<string, { bg: string; fg: string }> = {
  Published: { bg: C.greenSoft, fg: C.green },
  Approved: { bg: C.greenSoft, fg: C.green },
  "Under Research": { bg: C.orangeSoft, fg: C.orange },
  Pending: { bg: C.orangeSoft, fg: C.orange },
  Rejected: { bg: "#FDE7E5", fg: "#B3261E" },
};

export function StatusBadge({ status }: { status?: string }) {
  const label = status || "Under Research";
  const colors = BADGES[label] || BADGES["Under Research"];
  return (
    <View style={[s.badge, { backgroundColor: colors.bg }]}>
      <Text style={[s.badgeText, { color: colors.fg }]}>{label}</Text>
    </View>
  );
}

type Tab = { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; path: string };

// Botanist tabs - the same pages a Botanist has on the website
const BOTANIST_TABS: Tab[] = [
  { key: "home", label: "Home", icon: "home-outline", path: "/home" },
  { key: "records", label: "Records", icon: "document-text-outline", path: "/records" },
  { key: "requests", label: "Requests", icon: "git-pull-request-outline", path: "/requests" },
  { key: "profile", label: "Profile", icon: "person-outline", path: "/profile" },
];

// Visitor tabs - no login, public information only
const VISITOR_TABS: Tab[] = [
  { key: "explore", label: "Explore", icon: "leaf-outline", path: "/explore" },
  { key: "scan", label: "Scan", icon: "qr-code-outline", path: "/scan" },
  { key: "login", label: "Staff login", icon: "log-in-outline", path: "/" },
];

function Nav({ tabs, current }: { tabs: Tab[]; current: string }) {
  return (
    <View style={s.nav}>
      {tabs.map((t) => {
        const active = t.key === current;
        const color = active ? C.green : C.faint;
        return (
          <Pressable
            key={t.key}
            style={s.navItem}
            onPress={() => {
              if (active) return;
              if (t.key === "scan") router.push(t.path as any);
              else router.replace(t.path as any);
            }}
          >
            <Ionicons name={t.icon} size={20} color={color} />
            <Text style={[s.navText, { color, fontFamily: active ? F.semi : F.body }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function BottomNav({ current }: { current: "home" | "records" | "requests" | "profile" }) {
  return <Nav tabs={BOTANIST_TABS} current={current} />;
}

export function VisitorNav({ current }: { current: "explore" | "scan" }) {
  return <Nav tabs={VISITOR_TABS} current={current} />;
}

const s = StyleSheet.create({
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: F.semi },
  nav: { height: 72, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white, flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  navItem: { alignItems: "center", gap: 4, paddingHorizontal: 12 },
  navText: { fontSize: 11 },
});
