import { useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, Image, ActivityIndicator, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { api, PlantDetail as Plant, uploadPlantPhoto } from "../api";
import * as ImagePicker from "expo-image-picker";
import { C, F, friendlyDate } from "../theme";
import { StatusBadge } from "../components";
import { session, isExternal } from "../session";

export default function PlantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plant, setPlant] = useState<Plant | null>(null);
  const [error, setError] = useState("");

  // GET /api/plants/:id (includes photos). Reloads after coming back from Edit.
  useFocusEffect(useCallback(() => {
    api<Plant>(`/api/plants/${id}`)
      .then(setPlant)
      .catch((e) => setError(e.status === 404 ? "Plant not found." : e.message));
  }, [id]));

  const external = isExternal(session.user);
  const [uploading, setUploading] = useState(false);

  const reload = () =>
    api<Plant>(`/api/plants/${id}`).then(setPlant).catch((e) => setError(e.message));

  // Add a photo to an existing record (camera or gallery). Works for Internal and
  // External Botanists, like "Add another photo" on the website.
  const addPhoto = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", fromCamera ? "Allow the camera to take a photo." : "Allow photo access to choose a photo.");
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.3 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.3 });
    if (result.canceled) return;
    const size = result.assets[0].fileSize ?? 0;
    if (size > 5 * 1024 * 1024) {
      return Alert.alert("Photo too large", `This photo is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB.`);
    }
    setUploading(true);
    try {
      await uploadPlantPhoto(String(id), result.assets[0].uri);
      await reload();
      Alert.alert("Photo added", "The photo was saved to this record.");
    } catch (e: any) {
      Alert.alert("Photo not added", e.message);
    } finally {
      setUploading(false);
    }
  };

  const choosePhoto = () =>
    Alert.alert("Add photo", "Take a new photo or choose one from your gallery.", [
      { text: "Cancel", style: "cancel" },
      { text: "Gallery", onPress: () => addPhoto(false) },
      { text: "Camera", onPress: () => addPhoto(true) },
    ]);

  // Same as "Request delete" on the website: an Officer must approve it.
  const requestDelete = () =>
    Alert.alert("Request deletion?", "An Officer will review your request before the record is deleted.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Send request",
        style: "destructive",
        onPress: async () => {
          try {
            await api("/api/requests", { method: "POST", body: { plant_id: Number(id), request_type: "DELETE" } });
            Alert.alert("Request sent", "You can follow it in the Requests tab.");
          } catch (e: any) {
            Alert.alert("Could not send", e.message);
          }
        },
      },
    ]);

  const header = (
    <View style={s.header}>
      <Pressable style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <Text style={s.headerTitle}>Plant Details</Text>
    </View>
  );

  if (!plant) {
    return (
      <SafeAreaView style={s.safe}>
        {header}
        <View style={s.centerBox}>
          {error ? (
            <>
              <Ionicons name="alert-circle-outline" size={40} color={C.orange} />
              <Text style={s.errorText}>{error}</Text>
            </>
          ) : (
            <ActivityIndicator color={C.green} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Decimals come back as strings, e.g. "50.00"
  const num = (v?: string | null) => (v == null || v === "" ? null : Number(v));
  const height = num(plant.height_cm);
  const width = num(plant.width_cm);
  const lat = num(plant.latitude);
  const lng = num(plant.longitude);

  const rows: [string, string][] = [
    ["Common name", plant.common_name || "—"],
    ["Family", plant.family || "—"],
    ["Genus / species", [plant.genus, plant.species].filter(Boolean).join(" ") || "—"],
    ["Height", height != null ? `${height} cm` : "—"],
    ["Width", width != null ? `${width} cm` : "—"],
    ["Conservation status", plant.conservation_status || "—"],
    ["Registered by", plant.registered_by_name || "—"],
    ["Recorded", plant.created_at ? friendlyDate(plant.created_at) : "—"],
  ];

  const photos = plant.photos || [];

  return (
    <SafeAreaView style={s.safe}>
      {header}
      <ScrollView contentContainerStyle={s.content}>
        {photos.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {photos.map((p) => (
              <Image key={p.photo_id} source={{ uri: p.photo_url }}
                style={[s.photo, { width: photos.length > 1 ? 280 : 342 }]} />
            ))}
          </ScrollView>
        ) : (
          <View style={[s.photo, s.photoEmpty]}>
            <Ionicons name="image-outline" size={32} color={C.green} />
            <Text style={s.cardSub}>No photo</Text>
          </View>
        )}

        <View style={s.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{plant.scientific_name}</Text>
            <Text style={s.id}>{plant.qr_code}</Text>
          </View>
          <StatusBadge status={plant.publication_status} />
        </View>

        {plant.full_detail === false && (
          <Text style={s.notice}>You can only see the public details of this plant.</Text>
        )}

        <View style={s.card}>
          {rows.map(([label, value], i) => (
            <View key={label} style={[s.row, i < rows.length - 1 && s.rowLine]}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        {!!plant.morphological_notes && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Description</Text>
            <Text style={s.body}>{plant.morphological_notes}</Text>
          </View>
        )}

        {(lat != null || plant.general_location) && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Location</Text>
            <View style={s.gpsRow}>
              <Ionicons name="location-outline" size={18} color={C.green} />
              <Text style={s.body}>
                {lat != null && lng != null ? `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}` : plant.general_location}
              </Text>
            </View>
          </View>
        )}

        <View style={[s.card, { alignItems: "center" }]}>
          <Text style={[s.cardTitle, { alignSelf: "flex-start" }]}>QR Tag</Text>
          <QRCode value={plant.qr_code} size={150} color={C.text} backgroundColor={C.white} />
        </View>

        {/* Same actions a Botanist has on the website */}
        {plant.full_detail !== false && (
          <View style={{ gap: 10 }}>
            <Pressable style={[s.outline, uploading && { opacity: 0.6 }]} onPress={choosePhoto} disabled={uploading}>
              {uploading ? <ActivityIndicator color={C.green} /> : <Ionicons name="camera-outline" size={18} color={C.green} />}
              <Text style={s.outlineText}>{uploading ? "Uploading..." : photos.length ? "Add another photo" : "Add photo"}</Text>
            </Pressable>
            <Pressable style={s.outline} onPress={() => router.push({ pathname: "/edit-plant", params: { id: String(id) } })}>
              <Ionicons name="create-outline" size={18} color={C.green} />
              <Text style={s.outlineText}>{external ? "Request an edit" : "Edit record"}</Text>
            </Pressable>
            <Pressable style={s.danger} onPress={requestDelete}>
              <Ionicons name="trash-outline" size={18} color="#B3261E" />
              <Text style={s.dangerText}>Request delete</Text>
            </Pressable>
          </View>
        )}
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
  photoEmpty: { width: "100%", alignItems: "center", justifyContent: "center", gap: 6 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontFamily: F.title, fontSize: 22, color: C.text, fontStyle: "italic" },
  id: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  notice: { fontFamily: F.body, fontSize: 13, color: C.orange, backgroundColor: C.orangeSoft, padding: 10, borderRadius: 10 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, marginBottom: 8 },
  cardSub: { fontFamily: F.body, fontSize: 12, color: C.muted },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  rowLabel: { fontFamily: F.body, fontSize: 14, color: C.muted },
  rowValue: { fontFamily: F.semi, fontSize: 14, color: C.text, flexShrink: 1, textAlign: "right", marginLeft: 12 },
  body: { fontFamily: F.body, fontSize: 14, color: C.text, lineHeight: 20, flexShrink: 1 },
  outline: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  outlineText: { fontFamily: F.semi, fontSize: 15, color: C.green },
  danger: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: "#B3261E", backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  dangerText: { fontFamily: F.semi, fontSize: 15, color: "#B3261E" },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
});
