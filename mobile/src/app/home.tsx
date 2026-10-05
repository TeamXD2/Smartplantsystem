import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getPlants, Plant } from "../db";
import { session } from "../session";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge, BottomNav } from "../components";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const [plants, setPlants] = useState<Plant[]>([]);
  useFocusEffect(useCallback(() => { setPlants(getPlants()); }, []));

  const pending = plants.filter((p) => !p.synced).length;
  const allSynced = pending === 0;
  const name = session.email ? session.email.split("@")[0] : "Botanist";

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <View>
          <Text style={s.greet}>{greeting()}</Text>
          <Text style={s.name}>{name}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: allSynced ? C.greenSoft : C.orangeSoft }]}>
          <Ionicons name="sync-outline" size={14} color={allSynced ? C.green : C.orange} />
          <Text style={[s.pillText, { color: allSynced ? C.green : C.orange }]}>
            {allSynced ? "Synced" : `${pending} pending`}
          </Text>
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

      <Text style={s.sectionTitle}>Recent Records</Text>

      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 10 }}
        data={plants.slice(0, 3)}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={s.empty}>No records yet. Register your first plant!</Text>}
        renderItem={({ item }) => (
          <Pressable
            style={s.card}
            onPress={() => router.push({ pathname: "/plant-detail", params: { id: item.id } })}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{item.scientificName}</Text>
              <Text style={s.cardSub}>{friendlyDate(item.createdAt)}</Text>
            </View>
            <StatusBadge synced={!!item.synced} />
          </Pressable>
        )}
      />

      <BottomNav current="home" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greet: { fontFamily: F.body, fontSize: 13, color: C.muted },
  name: { fontFamily: F.title, fontSize: 22, color: C.text, textTransform: "capitalize" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 12 },
  pillText: { fontFamily: F.semi, fontSize: 12 },
  section: { paddingHorizontal: 24, paddingTop: 8 },
  scanBtn: { height: 120, borderRadius: 18, backgroundColor: C.green, alignItems: "center", justifyContent: "center", gap: 10 },
  scanText: { fontFamily: F.semi, fontSize: 17, color: C.bg },
  regBtn: { height: 56, borderRadius: 14, borderWidth: 1.5, borderColor: C.orange, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  regText: { fontFamily: F.semi, fontSize: 15, color: C.orange },
  sectionTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, fontStyle: "italic" },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 20 },
});