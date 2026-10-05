import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { C, F } from "./theme";

export function StatusBadge({ synced }: { synced: boolean }) {
  return (
    <View style={[s.badge, { backgroundColor: synced ? C.greenSoft : C.orangeSoft }]}>
      <Text style={[s.badgeText, { color: synced ? C.green : C.orange }]}>
        {synced ? "Synced" : "Pending"}
      </Text>
    </View>
  );
}

const TABS = [
  { key: "home", label: "Home", icon: "home-outline", path: "/home" },
  { key: "records", label: "Records", icon: "document-text-outline", path: "/records" },
    { key: "profile", label: "Profile", icon: "person-outline", path: "/profile" },
] as const;

export function BottomNav({ current }: { current: "home" | "records" | "profile" }) {
  return (
    <View style={s.nav}>
      {TABS.map((t) => {
        const active = t.key === current;
        const color = active ? C.green : C.faint;
        return (
          <Pressable
            key={t.key}
            style={s.navItem}
            onPress={() => { if (!active && t.path) router.replace(t.path as any); }}
          >
            <Ionicons name={t.icon} size={20} color={color} />
            <Text style={[s.navText, { color, fontFamily: active ? F.semi : F.body }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 20 },
  badgeText: { fontSize: 11, fontFamily: F.semi },
  nav: { height: 72, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.white, flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  navItem: { alignItems: "center", gap: 4, paddingHorizontal: 16 },
  navText: { fontSize: 11 },
});