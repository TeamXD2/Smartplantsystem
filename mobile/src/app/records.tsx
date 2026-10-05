import { useCallback, useState } from "react";
import { View, Text, Pressable, FlatList, Image, StyleSheet, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getPlants, Plant } from "../db";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge, BottomNav } from "../components";

type Filter = "All" | "Synced" | "Pending";

export default function Records() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");
  useFocusEffect(useCallback(() => { setPlants(getPlants()); }, []));

  // 1) filter by chip, 2) filter by search text
  const q = query.trim().toLowerCase();
  const shown = plants
    .filter((p) => (filter === "All" ? true : filter === "Synced" ? !!p.synced : !p.synced))
    .filter((p) =>
      q === "" ||
      p.scientificName.toLowerCase().includes(q) ||
      (p.commonName || "").toLowerCase().includes(q) ||
      (p.family || "").toLowerCase().includes(q)
    );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>My Records</Text>
        <Text style={s.sub}>{plants.length} records on this phone</Text>
      </View>

      {/* 🔍 Search bar */}
      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={18} color={C.faint} />
        <TextInput
          style={s.searchInput}
          placeholder="Search scientific, common or family name"
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
        {(["All", "Synced", "Pending"] as Filter[]).map((f) => {
          const active = f === filter;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[s.chip, active ? s.chipOn : s.chipOff]}>
              <Text style={[s.chipText, { color: active ? C.bg : C.muted }]}>{f}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10 }}
        data={shown}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={s.empty}>{q ? `No plants match "${query}".` : "No records here."}</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={s.card}
            onPress={() => router.push({ pathname: "/plant-detail", params: { id: item.id } })}
          >
            <Image source={{ uri: item.photo }} style={s.thumb} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.cardTitle} numberOfLines={1}>{item.scientificName}</Text>
              <Text style={s.cardSub} numberOfLines={1}>
                {friendlyDate(item.createdAt)}{item.commonName ? ` · ${item.commonName}` : ""}
              </Text>
            </View>
            <StatusBadge synced={!!item.synced} />
          </Pressable>
        )}
      />

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
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  chipOn: { backgroundColor: C.green },
  chipOff: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border },
  chipText: { fontFamily: F.semi, fontSize: 13 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: C.line },
  thumb: { width: 48, height: 48, borderRadius: 10, backgroundColor: C.greenSoft },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, fontStyle: "italic" },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 40 },
});