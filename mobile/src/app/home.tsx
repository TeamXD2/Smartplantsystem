import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { api, PlantList, PlantSummary, PlantRequest } from "../api";
import { session, roleLabel } from "../session";
import { C, F } from "../theme";
import { pendingPlants, syncPending } from "../offline";
import { BottomNav, PlantCard } from "../components";

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
  const [tab, setTab] = useState<"mine" | "park">("mine");
  const [parkPlants, setParkPlants] = useState<PlantSummary[]>([]);
  const [offlineCount, setOfflineCount] = useState(0);
  const [offlineNames, setOfflineNames] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState("");
  const [refresh, setRefresh] = useState(0);

  const readOffline = () => {
    const list = pendingPlants();
    setOfflineCount(list.length);
    setOfflineNames(list.map((p) => String(p.body.scientific_name || "Unnamed plant")));
    return list.length;
  };

  const syncNow = async () => {
    setSyncing(true);
    setSyncNote("");
    const r = await syncPending();
    setSyncing(false);
    readOffline();
    if (r.synced > 0) {
      setSyncNote(`${r.synced} plant${r.synced === 1 ? "" : "s"} uploaded. QR codes are ready in Records.`);
      setRefresh((n) => n + 1);
    } else if (r.offline) {
      setSyncNote("Still no connection. It will try again when you open Home.");
    } else if (r.failed > 0) {
      setSyncNote("Some plants couldn't upload. Check them and try again.");
    }
  };

  // Reload my plants every time Home opens
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    if (readOffline() > 0) syncNow();
    api<PlantList>("/api/plants?mine=true&limit=100")
      .then((d) => { if (active) { setPlants(d.plants); setTotal(d.total); setError(""); } })
      .catch((e) => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    api<PlantList>("/api/plants?publication_status=Published&limit=100")
      .then((d) => { if (active) setParkPlants(d.plants); })
      .catch(() => {});
    api<PlantRequest[]>("/api/requests/mine?status=Pending")
      .then((r) => { if (active) setPending(r.length); })
      .catch(() => {});
    return () => { active = false; };
  }, [refresh]));

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
          <Text style={s.scanText}>Scan a Plant Tag</Text>
        </Pressable>
      </View>

      <View style={[s.section, { paddingTop: 12 }]}>
        <Pressable style={s.regBtn} onPress={() => router.push("/register")}>
          <Ionicons name="add" size={20} color={C.orange} />
          <Text style={s.regText}>Register New Plant</Text>
        </Pressable>
      </View>

      {(offlineCount > 0 || !!syncNote) && (
        <View style={s.offline}>
          <Ionicons name={offlineCount > 0 ? "cloud-offline-outline" : "cloud-done-outline"} size={22} color={offlineCount > 0 ? C.orange : C.green} />
          <View style={{ flex: 1 }}>
            {offlineCount > 0 && (
              <>
                <Text style={s.offlineTitle}>
                  {offlineCount} plant{offlineCount === 1 ? "" : "s"} saved on this phone
                </Text>
                <Text style={s.offlineSub} numberOfLines={2}>{offlineNames.join(", ")}</Text>
              </>
            )}
            {!!syncNote && <Text style={s.offlineSub}>{syncNote}</Text>}
          </View>
          {offlineCount > 0 && (
            <Pressable style={s.syncBtn} onPress={syncNow} disabled={syncing} accessibilityRole="button">
              {syncing ? <ActivityIndicator color={C.white} size="small" /> : <Text style={s.syncText}>Sync now</Text>}
            </Pressable>
          )}
        </View>
      )}

      {/* Same numbers as the website Dashboard */}
      <View style={s.stats}>
        {stats.map(([label, n, color]) => (
          <View key={label} style={s.stat}>
            <Text style={[s.statNum, { color }]}>{n}</Text>
            <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
          </View>
        ))}
      </View>

      <View style={s.tabs}>
        {([["mine", "My recent records"], ["park", `Published Plants (${parkPlants.length})`]] as const).map(([key, label]) => (
          <Pressable key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]} numberOfLines={1}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16, gap: 10 }}
          data={tab === "mine" ? plants.slice(0, 3) : parkPlants}
          keyExtractor={(item) => String(item.plant_id)}
          ListEmptyComponent={
            <Text style={s.empty}>
              {tab === "park" ? "No published plants yet." : error || "No records yet. Register your first plant!"}
            </Text>
          }
          renderItem={({ item }) => (
            <PlantCard
              plant={item}
              status={tab === "park" ? undefined : item.publication_status}
              onPress={() => router.push({ pathname: "/plant-detail", params: { id: String(item.plant_id) } })}
            />
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
  offline: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 24, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line },
  offlineTitle: { fontFamily: F.semi, fontSize: 14, color: C.text },
  offlineSub: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  syncBtn: { backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 12, height: 36, alignItems: "center", justifyContent: "center", minWidth: 84 },
  syncText: { fontFamily: F.semi, fontSize: 13, color: C.white },
  stats: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingTop: 14 },
  stat: { flex: 1, backgroundColor: C.white, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 4, alignItems: "center", borderWidth: 1, borderColor: C.line },
  statNum: { fontFamily: F.title, fontSize: 20 },
  statLabel: { fontFamily: F.body, fontSize: 11, color: C.muted, marginTop: 2, textAlign: "center" },
  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingTop: 18, paddingBottom: 10 },
  tab: { flexShrink: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.white },
  tabActive: { backgroundColor: C.green, borderColor: C.green },
  tabText: { fontFamily: F.semi, fontSize: 12, color: C.text },
  tabTextActive: { color: C.white },
  empty: { fontFamily: F.body, color: C.muted, textAlign: "center", marginTop: 20 },
});
