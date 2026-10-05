import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { router } from "expo-router";
import { savePlant } from "../db";
import { C, F } from "../theme";

export default function RegisterPlant() {
  const [scientificName, setScientificName] = useState("");
  const [commonName, setCommonName] = useState("");
  const [family, setFamily] = useState("");
  const [height, setHeight] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // 📷 Open the camera and keep the photo
  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert("Camera permission is needed");
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled) setPhoto(result.assets[0].uri);
  };

  // 📍 Get the phone's current GPS location
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

  // 💾 Save to the phone's database, then show the QR code
  const save = () => {
    if (!scientificName || !photo || !coords) {
      return Alert.alert("Missing info", "Please add a scientific name, photo and GPS location.");
    }
    const id = "PLANT-" + Date.now();   // unique ID for this plant
    try {
      savePlant({ id, scientificName, commonName, family, height, notes, photo, lat: coords.lat, lng: coords.lng });
      router.replace({ pathname: "/plant-qr", params: { id, name: scientificName } });
    } catch (e) {
      Alert.alert("Error", "Could not save the record.");
      console.log(e);
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
          placeholder="e.g. Nepenthes rafflesiana" placeholderTextColor={C.faint} />

        <Text style={s.label}>Common name</Text>
        <TextInput style={s.input} value={commonName} onChangeText={setCommonName}
          placeholder="e.g. Raffles' pitcher plant" placeholderTextColor={C.faint} />

        <Text style={s.label}>Family</Text>
        <TextInput style={s.input} value={family} onChangeText={setFamily}
          placeholder="e.g. Nepenthaceae" placeholderTextColor={C.faint} />

        <Text style={s.label}>Height (cm)</Text>
        <TextInput style={s.input} value={height} onChangeText={setHeight} keyboardType="numeric"
          placeholder="e.g. 45" placeholderTextColor={C.faint} />

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

        <Pressable style={s.button} onPress={save}>
          <Text style={s.buttonText}>Save Record</Text>
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
  label: { fontFamily: F.semi, fontSize: 13, color: C.text, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 15, fontFamily: F.body, backgroundColor: C.white, marginBottom: 16 },
  outline: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 },
  outlineText: { fontFamily: F.semi, fontSize: 15, color: C.green },
  preview: { width: "100%", height: 200, borderRadius: 12, marginBottom: 12 },
  gps: { fontFamily: F.semi, textAlign: "center", color: C.green, marginBottom: 14 },
  button: { height: 52, borderRadius: 10, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", marginTop: 12 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});