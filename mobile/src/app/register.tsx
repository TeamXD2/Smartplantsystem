import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, Image, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { api, uploadPlantPhoto } from "../api";
import { C, F } from "../theme";

export default function RegisterPlant() {
  const [scientificName, setScientificName] = useState("");
  const [commonName, setCommonName] = useState("");
  const [family, setFamily] = useState("");
  const [genus, setGenus] = useState("");
  const [species, setSpecies] = useState("");
  const [height, setHeight] = useState("");
  const [width, setWidth] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // 📷 Camera (quality 0.5 keeps the photo under the backend's 5MB limit)
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera permission is needed");
    // quality 0.3 keeps photos from high-megapixel phone cameras under the 5 MB limit
    const result = await ImagePicker.launchCameraAsync({ quality: 0.3 });
    if (result.canceled) return;
    const size = result.assets[0].fileSize ?? 0;
    if (size > 5 * 1024 * 1024) {
      return Alert.alert("Photo too large", `This photo is ${(size / 1024 / 1024).toFixed(1)} MB. The limit is 5 MB - lower the camera resolution and try again.`);
    }
    setPhoto(result.assets[0].uri);
  };

  // 📍 GPS
  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return Alert.alert("Location permission is needed");
    setLocating(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } finally {
      setLocating(false);
    }
  };

  // 💾 1) POST /api/plants  2) POST /api/plants/:id/photos  3) show the QR
  const save = async () => {
    if (!scientificName.trim() || !photo || !coords) {
      return Alert.alert("Missing info", "Please add a scientific name, photo and GPS location.");
    }
    const h = height.trim() ? Number(height) : undefined;
    const w = width.trim() ? Number(width) : undefined;
    for (const [label, v] of [["Height", h], ["Width", w]] as const) {
      if (v !== undefined && (isNaN(v) || v < 0 || v > 9999.99)) {
        return Alert.alert(`Invalid ${label.toLowerCase()}`, `${label} must be a number between 0 and 9999.99 cm.`);
      }
    }

    setSaving(true);
    try {
      const created = await api<{ plant_id: number; qr_code: string }>("/api/plants", {
        method: "POST",
        body: {
          scientific_name: scientificName.trim(),
          common_name: commonName.trim() || undefined,
          family: family.trim() || undefined,
          genus: genus.trim() || undefined,
          species: species.trim() || undefined,
          height_cm: h,
          width_cm: w,
          morphological_notes: notes.trim() || undefined,
          latitude: coords.lat,
          longitude: coords.lng,
        },
      });

      // Upload the photo (field name must be "photo")
      // Keep the real reason so the botanist (and we) know why it failed
      let photoFailed = "";
      try {
        await uploadPlantPhoto(created.plant_id, photo);
      } catch (e: any) {
        photoFailed = e.message || "Unknown error";
      }

      router.replace({
        pathname: "/plant-qr",
        params: { qr: created.qr_code, id: String(created.plant_id), name: scientificName.trim(), photoFailed },
      });
    } catch (e: any) {
      Alert.alert("Could not save", e.message);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>Register New Plant</Text>
      </View>

      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.label}>Scientific name *</Text>
        <TextInput style={s.input} value={scientificName} onChangeText={setScientificName}
          placeholder="e.g. Nepenthes rafflesiana" placeholderTextColor={C.faint} maxLength={150} />

        <Text style={s.label}>Common name</Text>
        <TextInput style={s.input} value={commonName} onChangeText={setCommonName}
          placeholder="e.g. Raffles' pitcher plant" placeholderTextColor={C.faint} maxLength={150} />

        <Text style={s.label}>Family</Text>
        <TextInput style={s.input} value={family} onChangeText={setFamily}
          placeholder="e.g. Nepenthaceae" placeholderTextColor={C.faint} maxLength={100} />

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Genus</Text>
            <TextInput style={s.input} value={genus} onChangeText={setGenus}
              placeholder="e.g. Nepenthes" placeholderTextColor={C.faint} maxLength={100} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Species</Text>
            <TextInput style={s.input} value={species} onChangeText={setSpecies} autoCapitalize="none"
              placeholder="e.g. rafflesiana" placeholderTextColor={C.faint} maxLength={100} />
          </View>
        </View>

        <View style={s.row2}>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Height (cm)</Text>
            <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="numeric"
              placeholder="e.g. 45" placeholderTextColor={C.faint} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>Width (cm)</Text>
            <TextInput style={s.input} value={width} onChangeText={setWidth} keyboardType="numeric"
              placeholder="e.g. 20" placeholderTextColor={C.faint} />
          </View>
        </View>

        <Text style={s.label}>Description / features</Text>
        <TextInput style={[s.input, { height: 90, paddingTop: 12, textAlignVertical: "top" }]} value={notes}
          onChangeText={setNotes} multiline placeholder="Leaf shape, flower colour..." placeholderTextColor={C.faint} />

        <Pressable style={s.outline} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={18} color={C.green} />
          <Text style={s.outlineText}>{photo ? "Retake photo" : "Take photo *"}</Text>
        </Pressable>
        {photo && <Image source={{ uri: photo }} style={s.preview} />}

        <Pressable style={s.outline} onPress={getLocation}>
          <Ionicons name="location-outline" size={18} color={C.green} />
          <Text style={s.outlineText}>{locating ? "Getting location..." : "Get GPS location *"}</Text>
        </Pressable>
        {coords && <Text style={s.gps}>Lat {coords.lat.toFixed(5)}, Lng {coords.lng.toFixed(5)}</Text>}

        <Pressable style={[s.button, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={C.white} /> : <Text style={s.buttonText}>Save Record</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.title, fontSize: 22, color: C.text },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  row2: { flexDirection: "row", gap: 12 },
  label: { fontFamily: F.semi, fontSize: 13, color: C.text, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 15, fontFamily: F.body, backgroundColor: C.white, marginBottom: 16 },
  outline: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  outlineText: { fontFamily: F.semi, fontSize: 15, color: C.green },
  preview: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  gps: { fontFamily: F.semi, textAlign: "center", color: C.green, marginBottom: 14 },
  button: { height: 52, borderRadius: 10, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", marginTop: 12 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});
