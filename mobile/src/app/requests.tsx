import { useCallback, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { api, PlantRequest, FIELD_LABELS } from "../api";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge, BottomNav } from "../components";

// My Requests - same as the website's "My Requests" page:
// edit/delete requests and the Officer's decision + comment.
const FILTERS = ["All", "Pending", "Approved", "Rejected"] as const;
type Filter = (typeof FILTERS)[number];

function describe(r: PlantRequest) {
  if (r.request_type === "DELETE") return "Delete this record";
  const entries = Object.entries(r.proposed_changes || {});
  if (entries.length === 0) return "Edit";
  return entries.map(([k, v]) => `${FIELD_LABELS[k] || k}: ${v === null ? "(empty)" : String(v)}`).join("\n");
}

export default function Requests() {
  const [requests, setRequests] = useState<PlantRequest[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    api<PlantRequest[]>("/api/requests/mine")
      .then((r) => { if (active) { setRequests(r); setError(""); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const shown = requests.filter((r) => filter === "All" || r.status === filter);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Requests</Text>
        <Text style={s.sub}>Edit and delete requests reviewed by an Officer</Text>
      </View>

      <View style={s.chips}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[s.chip, active ? s.chipOn : s.chipOff]}>
              <Text style={[s.chipText, { color: active ? C.bg : C.muted }]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10 }}
          data={shown}
          keyExtractor={(r) => String(r.request_id)}
          ListEmptyComponent={<Text style={s.empty}>{error || "No requests here."}</Text>}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle} numberOfLines={1}>{item.plant_scientific_name_snapshot}</Text>
                  <Text style={s.cardSub}>{item.plant_qr_code_snapshot} · {friendlyDate(item.requested_at)}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <Text style={s.change}>{describe(item)}</Text>
              {!!item.review_comment && (
                <Text style={s.comment}>
                  Officer: {item.review_comment}{item.reviewed_by_name ? ` (${item.reviewed_by_name})` : ""}
                </Text>
              )}
            </View>
          )}
        />
      )}

      <BottomNav current="requests" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14 },
  title: { fontFamily: F.title, fontSize: 22, color: C.text },
  sub: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingBottom: 14, flexWrap: "wrap" },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  chipOn: { backgroundColor: C.green },
  chipOff: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  chipText: { fontFamily: F.semi, fontSize: 13 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, fontStyle: "italic" },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  change: { fontFamily: F.body, fontSize: 13, color: C.text, backgroundColor: C.bg, borderRadius: 10, padding: 10, lineHeight: 19 },
  comment: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic" },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 40 },
});
