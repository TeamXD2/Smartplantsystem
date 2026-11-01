import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { api, PublicPlant } from "../api";
import { C, F } from "../theme";

// Public plant page for visitors - the same information as the website's
// species page (GET /api/public/plants/qr/:qr). Unpublished plants are "not found".
export default function Species() {
  const { qr } = useLocalSearchParams<{ qr: string }>();
  const [plant, setPlant] = useState<PublicPlant | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<PublicPlant>(`/api/public/plants/qr/${encodeURIComponent(String(qr))}`, { auth: false })
      .then(setPlant)
      .catch((e) => setError(e.status === 404 ? "This plant isn't published yet, or the tag is not a RimbaTag code." : e.message));
  }, [qr]);

  const header = (
    <View style={s.header}>
      <Pressable style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/explore"))}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <Text style={s.headerTitle}>Plant Info</Text>
    </View>
  );

  if (!plant) {
    return (
      <SafeAreaView style={s.safe}>
        {header}
        <View style={s.centerBox}>
          {error ? (
            <>
              <Ionicons name="leaf-outline" size={40} color={C.orange} />
              <Text style={s.errorText}>{error}</Text>
            </>
          ) : (
            <ActivityIndicator color={C.green} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const num = (v?: string | null) => (v == null || v === "" ? null : Number(v));
  const height = num(plant.height_cm);
  const width = num(plant.width_cm);
  const lat = num(plant.latitude);
  const lng = num(plant.longitude);
  const rows: [string, string][] = [
    ["Family", plant.family || "—"],
    ["Genus / species", [plant.genus, plant.species].filter(Boolean).join(" ") || "—"],
    ["Conservation status", plant.conservation_status || "Not assessed"],
    ["Height", height != null ? `${height} cm` : "—"],
    ["Width", width != null ? `${width} cm` : "—"],
  ];
  const sections: [string, string | null | undefined][] = [
    ["Appearance", plant.morphological_notes],
    ["Ecological role", plant.ecological_role],
    ["Medicinal use", plant.medicinal_use],
    ["Cultural significance", plant.cultural_significance],
  ];
  const photos = plant.photos || [];

  return (
    <SafeAreaView style={s.safe}>
      {header}
      <ScrollView contentContainerStyle={s.content}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photos.map((p) => (
              <Image key={p.photo_id} source={{ uri: p.photo_url }} style={[s.photo, { width: photos.length > 1 ? 280 : 342 }]} />
            ))}
          </ScrollView>
        ) : (
          <View style={[s.photo, s.photoEmpty]}><Ionicons name="leaf-outline" size={36} color={C.green} /></View>
        )}

        <View>
          <Text style={s.name}>{plant.common_name || plant.scientific_name}</Text>
          {!!plant.common_name && <Text style={s.sci}>{plant.scientific_name}</Text>}
        </View>

        <View style={s.card}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[s.row, i < rows.length - 1 && s.rowLine]}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        {sections.filter(([, text]) => !!text).map(([title, text]) => (
          <View key={title} style={s.card}>
            <Text style={s.cardTitle}>{title}</Text>
            <Text style={s.body}>{text}</Text>
          </View>
        ))}

        {/* Location only as much as the Officer allowed (Public / Approximate / Hidden) */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Location</Text>
          <View style={s.gpsRow}>
            <Ionicons name="location-outline" size={18} color={C.green} />
            <Text style={s.body}>
              {lat != null && lng != null
                ? `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`
                : plant.general_location || "Hidden to protect this species"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: F.title, fontSize: 22, color: C.text },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  errorText: { fontFamily: F.semi, fontSize: 15, color: C.text, textAlign: "center" },
  content: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  photo: { height: 220, borderRadius: 16, backgroundColor: C.greenSoft },
  photoEmpty: { width: "100%", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: F.title, fontSize: 24, color: C.text },
  sci: { fontFamily: F.body, fontSize: 15, color: C.muted, fontStyle: "italic", marginTop: 2 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel: { fontFamily: F.body, fontSize: 14, color: C.muted },
  rowValue: { fontFamily: F.semi, fontSize: 14, color: C.text, flexShrink: 1, textAlign: "right", marginLeft: 12 },
  body: { fontFamily: F.body, fontSize: 14, color: C.text, lineHeight: 20, flexShrink: 1 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
