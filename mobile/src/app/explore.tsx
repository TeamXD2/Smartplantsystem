import { useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, Image, StyleSheet, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, PublicPlant } from "../api";
import { C, F } from "../theme";
import { VisitorNav } from "../components";

// Visitor view - the same public Species Catalog as the website. No login:
// only published plants, and no exact GPS for protected species.
export default function Explore() {
  const [plants, setPlants] = useState<PublicPlant[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search on the server, after the visitor stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      const search = query.trim() ? `&search=${encodeURIComponent(query.trim())}` : "";
      api<{ plants: PublicPlant[] }>(`/api/public/plants?limit=100${search}`, { auth: false })
        .then((d) => { setPlants(d.plants); setError(""); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={s.logo}><Ionicons name="leaf-outline" size={20} color={C.bg} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Explore Niah</Text>
          <Text style={s.sub}>Plants of Niah National Park</Text>
        </View>
      </View>

      {/* Big scan button, like the botanist Home screen */}
      <View style={s.section}>
        <Pressable style={s.scanBtn} onPress={() => router.push("/scan")}>
          <Ionicons name="qr-code-outline" size={30} color={C.bg} />
          <Text style={s.scanText}>Scan a Plant Tag</Text>
        </Pressable>
      </View>

      <View style={s.searchBox}>
        <Ionicons name="search-outline" size={18} color={C.faint} />
        <TextInput
          style={s.searchInput}
          placeholder="Search scientific, common name or family"
          placeholderTextColor={C.faint}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
      </View>

      {loading && plants.length === 0 ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10 }}
          data={plants}
          keyExtractor={(p) => p.qr_code}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text style={s.empty}>{error || "No published species yet."}</Text>}
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => router.push({ pathname: "/species", params: { qr: item.qr_code } })}>
              {item.cover_photo_url ? (
                <Image source={{ uri: item.cover_photo_url }} style={s.thumb} />
              ) : (
                <View style={[s.thumb, s.thumbEmpty]}><Ionicons name="leaf-outline" size={20} color={C.green} /></View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.common_name || item.scientific_name}</Text>
                {!!item.common_name && <Text style={s.cardSci} numberOfLines={1}>{item.scientific_name}</Text>}
                {!!item.family && <Text style={s.cardSub} numberOfLines={1}>{item.family}</Text>}
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </Pressable>
          )}
        />
      )}

      <VisitorNav current="explore" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 24, paddingTop: 22, paddingBottom: 12 },
  logo: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.title, fontSize: 22, color: C.text },
  sub: { fontFamily: F.body, fontSize: 13, color: C.muted },
  section: { paddingHorizontal: 24, paddingBottom: 12 },
  scanBtn: { height: 96, borderRadius: 18, backgroundColor: C.green, alignItems: "center", justifyContent: "center", gap: 8 },
  scanText: { fontFamily: F.semi, fontSize: 16, color: C.bg },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 24, marginBottom: 12, height: 46, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.white, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontFamily: F.body, fontSize: 14, color: C.text },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: C.line },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: C.greenSoft },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  cardTitle: { fontFamily: F.semi, fontSize: 15, color: C.text },
  cardSci: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic", marginTop: 1 },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.faint, marginTop: 2 },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 40 },
});
