import { View, Text, Pressable, StyleSheet, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { getPlant } from "../db";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge } from "../components";

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const plant = getPlant(String(id));

  // If the ID isn't in the database
  if (!plant) {
    return (
      <SafeAreaView style={[s.safe, { alignItems: "center", justifyContent: "center", padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={40} color={C.orange} />
        <Text style={s.name}>Plant not found</Text>
        <Pressable style={s.button} onPress={() => router.back()}>
          <Text style={s.buttonText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const rows: [string, string][] = [
    ["Common name", plant.commonName || "—"],
    ["Family", plant.family || "—"],
    ["Height", plant.height ? `${plant.height} cm` : "—"],
    ["Recorded", friendlyDate(plant.createdAt)],
  ];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.headerTitle}>Plant Details</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Image source={{ uri: plant.photo }} style={s.photo} />

        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{plant.scientificName}</Text>
            <Text style={s.id}>{plant.id}</Text>
          </View>
          <StatusBadge synced={!!plant.synced} />
        </View>

        {/* Taxonomy & details */}
        <View style={s.card}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[s.row, i < rows.length - 1 && s.rowLine]}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* Description */}
        {!!plant.notes && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Description</Text>
            <Text style={s.body}>{plant.notes}</Text>
          </View>
        )}

        {/* GPS */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Location</Text>
          <View style={s.gpsRow}>
            <Ionicons name="location-outline" size={18} color={C.green} />
            <Text style={s.body}>Lat {plant.lat.toFixed(5)}, Lng {plant.lng.toFixed(5)}</Text>
          </View>
        </View>

        {/* QR tag */}
        <View style={[s.card, { alignItems: "center" }]}>
          <Text style={[s.cardTitle, { alignSelf: "flex-start" }]}>QR Tag</Text>
          <QRCode value={plant.id} size={150} color={C.text} backgroundColor={C.white} />
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
  content: { paddingHorizontal: 24, paddingBottom: 40, gap: 14 },
  photo: { width: "100%", height: 220, borderRadius: 16, backgroundColor: C.greenSoft },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: F.title, fontSize: 22, color: C.text, fontStyle: "italic" },
  id: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel: { fontFamily: F.body, fontSize: 14, color: C.muted },
  rowValue: { fontFamily: F.semi, fontSize: 14, color: C.text, flexShrink: 1, textAlign: "right", marginLeft: 12 },
  body: { fontFamily: F.body, fontSize: 14, color: C.text, lineHeight: 20 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  button: { height: 52, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, marginTop: 16 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});