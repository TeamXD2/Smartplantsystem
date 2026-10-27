import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, Image, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { api, PlantList, PlantSummary } from "../api";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge, BottomNav } from "../components";

const FILTERS = ["All", "Under Research", "Published"] as const;
type Filter = (typeof FILTERS)[number];

export default function Records() {
  const [plants, setPlants] = useState<PlantSummary[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // GET /api/plants?mine=true → plants I registered
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    api<PlantList>("/api/plants?mine=true&limit=100")
      .then((d) => { if (active) { setPlants(d.plants); setError(""); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []));

  const q = query.trim().toLowerCase();
  const shown = plants
    .filter((p) => filter === "All" || p.publication_status === filter)
    .filter((p) =>
      q === "" ||
      p.scientific_name.toLowerCase().includes(q) ||
      (p.common_name || "").toLowerCase().includes(q) ||
      (p.family || "").toLowerCase().includes(q) ||
      p.qr_code.toLowerCase().includes(q)
    );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Records</Text>
        <Text style={s.sub}>{plants.length} plants registered by you</Text>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={18} color={C.faint} />
        <TextInput
          style={s.searchInput}
          placeholder="Search name, family or QR code"
          placeholderTextColor={C.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query !== "" && (
          <Pressable onPress={() => setQuery("")}>
            <Ionicons name="close-circle" size={18} color={C.faint} />
          </Pressable>
        )}
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
          keyExtractor={(item) => String(item.plant_id)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <Text style={s.empty}>{error || (q ? `No plants match "${query}".` : "No records here.")}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              onPress={() => router.push({ pathname: "/plant-detail", params: { id: String(item.plant_id) } })}
            >
              {item.cover_photo_url ? (
                <Image source={{ uri: item.cover_photo_url }} style={s.thumb} />
              ) : (
                <View style={[s.thumb, s.thumbEmpty]}>
                  <Ionicons name="leaf-outline" size={20} color={C.green} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.scientific_name}</Text>
                <Text style={s.cardSub} numberOfLines={1}>
                  {item.created_at ? friendlyDate(item.created_at) : ""}{item.common_name ? ` · ${item.common_name}` : ""}
                </Text>
              </View>
              <StatusBadge status={item.publication_status} />
            </Pressable>
          )}
        />
      )}

      <BottomNav current="records" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 14 },
  title: { fontFamily: F.title, fontSize: 22, color: C.text },
  sub: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 24, marginBottom: 12, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.text },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingBottom: 14 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  chipOn: { backgroundColor: C.green },
  chipOff: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  chipText: { fontFamily: F.semi, fontSize: 13 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: C.line },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: C.greenSoft },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, fontStyle: "italic" },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 40 },
});
