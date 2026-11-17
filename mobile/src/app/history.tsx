import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { api } from "../api";
import { C, F } from "../theme";

type PublicVersion = {
  version_no: number;
  source: "REGISTER" | "EDIT" | "REQUEST" | "BACKFILL";
  created_at: string;
  changed_by_role: string | null;
  [field: string]: unknown;
};

const FIELDS: [string, string][] = [
  ["common_name", "Common name"],
  ["scientific_name", "Scientific name"],
  ["family", "Family"],
  ["genus", "Genus"],
  ["species", "Species"],
  ["height_cm", "Height (cm)"],
  ["width_cm", "Width (cm)"],
  ["conservation_status", "Conservation status"],
  ["morphological_notes", "Appearance"],
  ["ecological_role", "Ecological role"],
  ["medicinal_use", "Medicinal use"],
  ["cultural_significance", "Cultural significance"],
];

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function same(a: unknown, b: unknown) {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) || isEmpty(b)) return false;
  if (!Number.isNaN(Number(a)) && !Number.isNaN(Number(b))) return Number(a) === Number(b);
  return String(a) === String(b);
}

function show(v: unknown) {
  if (isEmpty(v)) return "(empty)";
  const t = String(v);
  return /^\d+\.\d+$/.test(t) ? String(Number(t)) : t;
}

function date(iso: string) {
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}

export default function History() {
  const { qr, name } = useLocalSearchParams<{ qr: string; name?: string }>();
  const [versions, setVersions] = useState<PublicVersion[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ versions: PublicVersion[] }>(`/api/public/plants/qr/${encodeURIComponent(String(qr))}/versions`, { auth: false })
      .then((d) => setVersions(d.versions))
      .catch((e) => setError(e.message));
  }, [qr]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Plant history</Text>
          {!!name && <Text style={s.headerSub} numberOfLines={1}>{name}</Text>}
        </View>
      </View>

      {!versions ? (
        <View style={s.centerBox}>
          {error ? <Text style={s.errorText}>{error}</Text> : <ActivityIndicator color={C.green} />}
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.intro}>
            Botanists visit this plant over time. Each visit that changes the record is saved as a new version, so nothing earlier is lost.
          </Text>

          {versions.map((v, i) => {
            const previous = versions[i + 1];
            const changes = previous ? FIELDS.filter(([f]) => !same(v[f], previous[f])) : [];
            const who = v.changed_by_role ? `a ${v.changed_by_role === "Admin" ? "park administrator" : v.changed_by_role.toLowerCase()}` : "park staff";
            return (
              <View key={v.version_no} style={s.item}>
                <View style={s.rail}>
                  <View style={[s.dot, i === 0 && s.dotCurrent]} />
                  {i < versions.length - 1 && <View style={s.railLine} />}
                </View>
                <View style={s.card}>
                  <View style={s.top}>
                    <Text style={s.version}>Version {v.version_no}</Text>
                    {i === 0 && <Text style={s.badge}>LATEST</Text>}
                  </View>
                  <Text style={s.meta}>
                    {date(v.created_at)} · {previous ? `Updated by ${who}` : `First recorded by ${who}`}
                  </Text>

                  {previous && changes.length === 0 && <Text style={s.muted}>Photos or location updated.</Text>}

                  {changes.map(([f, label]) => (
                    <View key={f} style={s.change}>
                      <Text style={s.label}>{label}</Text>
                      <View style={s.diff}>
                        <Text style={s.oldValue}>{show(previous![f])}</Text>
                        <Ionicons name="arrow-forward" size={14} color={C.muted} />
                        <Text style={s.newValue}>{show(v[f])}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: F.title, fontSize: 22, color: C.text },
  headerSub: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  errorText: { fontFamily: F.semi, fontSize: 15, color: C.text, textAlign: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  intro: { fontFamily: F.body, fontSize: 14, color: C.muted, lineHeight: 20, marginBottom: 4 },
  item: { flexDirection: "row", gap: 10 },
  rail: { width: 16, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.green, backgroundColor: C.white, marginTop: 18 },
  dotCurrent: { backgroundColor: C.green },
  railLine: { flex: 1, width: 2, backgroundColor: C.border, marginTop: 2, marginBottom: -14 },
  card: { flex: 1, backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, gap: 6 },
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  version: { fontFamily: F.title, fontSize: 18, color: C.text },
  badge: { fontFamily: F.semi, fontSize: 10, color: C.white, backgroundColor: C.green, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  meta: { fontFamily: F.body, fontSize: 13, color: C.muted },
  muted: { fontFamily: F.body, fontSize: 13, color: C.muted },
  change: { backgroundColor: C.orangeSoft, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  label: { fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 2 },
  diff: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  oldValue: { fontFamily: F.body, fontSize: 14, color: "#B3261E", textDecorationLine: "line-through" },
  newValue: { fontFamily: F.semi, fontSize: 14, color: C.green },
});
