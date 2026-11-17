import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { api, PublicPlant } from "../api";
import { C, F } from "../theme";

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
  const details = ([
    ["Family", plant.family],
    ["Genus", plant.genus],
    ["Species", plant.species],
    ["Conservation status", plant.conservation_status],
    ["Height", height != null ? `${height} cm` : null],
    ["Width", width != null ? `${width} cm` : null],
  ] as [string, string | null | undefined][]).filter(([, value]) => !!value);
  const sections = ([
    ["Appearance", plant.morphological_notes],
    ["Ecological role", plant.ecological_role],
    ["Medicinal use", plant.medicinal_use],
    ["Cultural significance", plant.cultural_significance],
  ] as [string, string | null | undefined][]).filter(([, text]) => !!text);
  const photos = plant.photos || [];
  const place =
    lat != null && lng != null
      ? `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`
      : plant.general_location || "Location hidden to protect this species";

  return (
    <SafeAreaView style={s.safe}>
      {header}
      <ScrollView contentContainerStyle={s.content}>
        <View>
          {photos.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {photos.map((p) => (
                <Image key={p.photo_id} source={{ uri: p.photo_url }} style={[s.photo, { width: 300 }]} />
              ))}
            </ScrollView>
          ) : photos.length === 1 ? (
            <Image source={{ uri: photos[0].photo_url }} style={[s.photo, { width: "100%" }]} />
          ) : (
            <View style={[s.photo, s.photoEmpty]}><Ionicons name="leaf-outline" size={36} color={C.green} /></View>
          )}
          <Text style={s.qr}>{plant.qr_code}</Text>
        </View>

        <View>
          <Text style={s.name}>{plant.common_name || plant.scientific_name}</Text>
          {!!plant.common_name && <Text style={s.sci}>{plant.scientific_name}</Text>}
        </View>

        {details.length > 0 && (
          <View style={s.card}>
            {details.map(([label, value], i) => (
              <View key={label} style={[s.row, i < details.length - 1 && s.rowLine]}>
                <Text style={s.rowLabel}>{label}</Text>
                <Text style={s.rowValue}>{value}</Text>
              </View>
            ))}
          </View>
        )}

        {sections.map(([title, text]) => (
          <View key={title}>
            <Text style={s.sectionTitle}>{title}</Text>
            <Text style={s.body}>{text}</Text>
          </View>
        ))}

        <View style={s.gpsRow}>
          <Ionicons name="location-outline" size={18} color={C.text} />
          <Text style={s.place}>{place}</Text>
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
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 18 },
  photo: { height: 240, borderRadius: 16, backgroundColor: C.greenSoft },
  photoEmpty: { width: "100%", alignItems: "center", justifyContent: "center" },
  qr: { position: "absolute", top: 10, right: 10, fontFamily: "monospace", fontSize: 12, color: C.green, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: "hidden" },
  name: { fontFamily: F.title, fontSize: 28, color: C.text },
  sci: { fontFamily: F.body, fontSize: 16, color: C.muted, fontStyle: "italic", marginTop: 4 },
  card: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line },
  row: { paddingVertical: 12, paddingHorizontal: 16, gap: 3 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel: { fontFamily: F.body, fontSize: 12, color: C.muted },
  rowValue: { fontFamily: F.semi, fontSize: 15, color: C.text },
  sectionTitle: { fontFamily: F.semi, fontSize: 15, color: C.text, marginBottom: 4 },
  body: { fontFamily: F.body, fontSize: 15, color: C.text, lineHeight: 22 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  place: { fontFamily: F.semi, fontSize: 15, color: C.text, flexShrink: 1 },
});
