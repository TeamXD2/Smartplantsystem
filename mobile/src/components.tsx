import { View, Text, Pressable, StyleSheet, Image } from "react-native";
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

type CardPlant = {
  scientific_name: string;
  common_name?: string | null;
  family?: string | null;
  cover_photo_url?: string | null;
};

export function PlantCard({ plant, status, onPress }: { plant: CardPlant; status?: string; onPress: () => void }) {
  return (
    <Pressable style={s.card} onPress={onPress}>
      {plant.cover_photo_url ? (
        <Image source={{ uri: plant.cover_photo_url }} style={s.thumb} />
      ) : (
        <View style={[s.thumb, s.thumbEmpty]}><Ionicons name="leaf-outline" size={20} color={C.green} /></View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.cardTitle} numberOfLines={1}>{plant.common_name || plant.scientific_name}</Text>
        {!!plant.common_name && <Text style={s.cardSci} numberOfLines={1}>{plant.scientific_name}</Text>}
        {!!plant.family && <Text style={s.cardSub} numberOfLines={1}>{plant.family}</Text>}
      </View>
      {status ? <StatusBadge status={status} /> : <Ionicons name="chevron-forward" size={18} color={C.faint} />}
    </Pressable>
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
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: C.line },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: C.greenSoft },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: F.semi, fontSize: 15, color: C.text },
  cardSci: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic", marginTop: 1 },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.faint, marginTop: 2 },
});
