import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { api, PlantList, PlantSummary, PlantRequest } from "../api";
import { session, roleLabel } from "../session";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge, BottomNav } from "../components";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const [plants, setPlants] = useState<PlantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(0);

  // Reload my plants every time Home opens
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    api<PlantList>("/api/plants?mine=true&limit=100")
      .then((d) => { if (active) { setPlants(d.plants); setTotal(d.total); setError(""); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    api<PlantRequest[]>("/api/requests/mine?status=Pending")
      .then((r) => { if (active) setPending(r.length); })
      .catch(() => {});
    return () => { active = false; };
  }, []));

  const published = plants.filter((p) => p.publication_status === "Published").length;
  const stats: [string, number, string][] = [
    ["My records", total, C.text],
    ["Published", published, C.green],
    ["Under Research", plants.length - published, C.orange],
    ["Pending requests", pending, pending ? C.orange : C.text],
  ];

  const name = session.user?.full_name?.split(" ")[0] || "Botanist";

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greet}>{greeting()}</Text>
          <Text style={s.name} numberOfLines={1}>{name}</Text>
        </View>
        <View style={s.pill}>
          <Ionicons name="leaf-outline" size={14} color={C.green} />
          <Text style={s.pillText}>{roleLabel(session.user)}</Text>
        </View>
      </View>

      <View style={s.section}>
        <Pressable style={s.scanBtn} onPress={() => router.push("/scan")}>
          <Ionicons name="qr-code-outline" size={34} color={C.bg} />
          <Text style={s.scanText}>Scan QR Code</Text>
        </Pressable>
      </View>

      <View style={[s.section, { paddingTop: 12 }]}>
        <Pressable style={s.regBtn} onPress={() => router.push("/register")}>
          <Ionicons name="add" size={20} color={C.orange} />
          <Text style={s.regText}>Register New Plant</Text>
        </Pressable>
      </View>

      {/* Same numbers as the website Dashboard */}
      <View style={s.stats}>
        {stats.map(([label, n, color]) => (
          <View key={label} style={s.stat}>
            <Text style={[s.statNum, { color }]}>{n}</Text>
            <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.sectionTitle}>Recent Records</Text>

      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
          data={plants.slice(0, 3)}
          keyExtractor={(item) => String(item.plant_id)}
          ListEmptyComponent={
            <Text style={s.empty}>{error || "No records yet. Register your first plant!"}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={s.card}
              onPress={() => router.push({ pathname: "/plant-detail", params: { id: String(item.plant_id) } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle} numberOfLines={1}>{item.scientific_name}</Text>
                <Text style={s.cardSub}>{item.created_at ? friendlyDate(item.created_at) : item.qr_code}</Text>
              </View>
              <StatusBadge status={item.publication_status} />
            </Pressable>
          )}
        />
      )}

      <BottomNav current="home" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  greet: { fontFamily: F.body, fontSize: 13, color: C.muted },
  name: { fontFamily: F.title, fontSize: 22, color: C.text },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: C.greenSoft },
  pillText: { fontFamily: F.semi, fontSize: 12, color: C.green },
  section: { paddingHorizontal: 24, paddingTop: 8 },
  scanBtn: { height: 120, borderRadius: 18, backgroundColor: C.green, alignItems: "center", justifyContent: "center", gap: 10 },
  scanText: { fontFamily: F.semi, fontSize: 17, color: C.bg },
  regBtn: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: C.orange, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  regText: { fontFamily: F.semi, fontSize: 15, color: C.orange },
  stats: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingTop: 14 },
  stat: { flex: 1, backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, alignItems: "center", borderWidth: 1, borderColor: C.line },
  statNum: { fontFamily: F.title, fontSize: 20 },
  statLabel: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 2, textAlign: "center" },
  sectionTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, fontStyle: "italic" },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 20 },
});
