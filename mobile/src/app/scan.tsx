import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { getPlant } from "../db";
import { C, F } from "../theme";

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  if (!permission) return <View style={s.dark} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={[s.dark, s.center, { padding: 32 }]}>
        <Text style={s.title}>Camera access is needed to scan plant tags.</Text>
        <Pressable style={s.allow} onPress={requestPermission}>
          <Text style={s.allowText}>Allow camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

   const handleScan = ({ data }: { data: string }) => {
    setScanned(true);
    const plant = getPlant(data);
    if (plant) {
      router.replace({ pathname: "/plant-detail", params: { id: plant.id } });
    } else {
      Alert.alert("Unknown tag", "This QR code is not a registered plant.", [
        { text: "Try again", onPress: () => setScanned(false) },
      ]);
    }
  };

  return (
    <View style={s.dark}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanned ? undefined : handleScan}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.top}>
          <Pressable style={s.round} onPress={() => router.back()}>
            <Ionicons name="close" size={20} color={C.bg} />
          </Pressable>
          <Text style={s.title}>Scan Plant Tag</Text>
          <Pressable style={[s.round, torch && { backgroundColor: C.orange }]} onPress={() => setTorch(!torch)}>
            <Ionicons name="flash-outline" size={18} color={C.bg} />
          </Pressable>
        </View>

        <View style={s.center}>
          <View style={s.frame}>
            <View style={[s.corner, s.tl]} />
            <View style={[s.corner, s.tr]} />
            <View style={[s.corner, s.bl]} />
            <View style={[s.corner, s.br]} />
          </View>
        </View>

        <View style={s.bottom}>
          <Text style={s.title}>Align QR code within the frame</Text>
          <Text style={s.hint}>Detected tags load automatically</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  dark: { flex: 1, backgroundColor: C.dark },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(247,245,239,0.15)", alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.semi, fontSize: 15, color: C.bg, textAlign: "center" },
  hint: { fontFamily: F.body, fontSize: 13, color: "rgba(247,245,239,0.6)" },
  frame: { width: 250, height: 250 },
  corner: { position: "absolute", width: 36, height: 36, borderColor: C.orange },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 8 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 8 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 8 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 8 },
  bottom: { paddingHorizontal: 40, paddingBottom: 60, gap: 8, alignItems: "center" },
  allow: { backgroundColor: C.orange, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, marginTop: 20 },
  allowText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});