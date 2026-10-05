import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { C, F } from "../theme";

export default function PlantQR() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={s.check}>
          <Ionicons name="checkmark" size={30} color={C.white} />
        </View>
        <Text style={s.title}>Plant Registered</Text>
        <Text style={s.name}>{name}</Text>

        <View style={s.qrBox}>
          <QRCode value={String(id)} size={210} color={C.text} backgroundColor={C.white} />
        </View>

        <View style={s.idPill}>
          <Ionicons name="pricetag-outline" size={14} color={C.green} />
          <Text style={s.idText}>{id}</Text>
        </View>

        <Text style={s.hint}>Print this QR code and attach it to the plant tag.</Text>

        <View style={s.status}>
          <Ionicons name="phone-portrait-outline" size={14} color={C.orange} />
          <Text style={s.statusText}>Saved on phone · will sync when online</Text>
        </View>
      </View>

      <View style={s.footer}>
        <Pressable style={s.secondary} onPress={() => router.replace("/register")}>
          <Ionicons name="add" size={18} color={C.orange} />
          <Text style={s.secondaryText}>Register Another</Text>
        </Pressable>
        <Pressable style={s.button} onPress={() => router.replace("/home")}>
          <Text style={s.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  check: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.green, alignItems: "center", justifyContent: "center", marginBottom: 14 },
  title: { fontFamily: F.title, fontSize: 24, color: C.text },
  name: { fontFamily: F.body, fontSize: 16, fontStyle: "italic", color: C.muted, marginTop: 4, marginBottom: 24 },
  qrBox: { backgroundColor: C.white, padding: 20, borderRadius: 18, borderWidth: 1, borderColor: C.line },
  idPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.greenSoft, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, marginTop: 16 },
  idText: { fontFamily: F.semi, fontSize: 13, color: C.green },
  hint: { fontFamily: F.body, fontSize: 13, color: C.muted, textAlign: "center", marginTop: 12 },
  status: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.orangeSoft, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, marginTop: 14 },
  statusText: { fontFamily: F.semi, fontSize: 12, color: C.orange },
  footer: { paddingHorizontal: 24, paddingBottom: 24, gap: 10 },
  secondary: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: C.orange, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryText: { fontFamily: F.semi, fontSize: 15, color: C.orange },
  button: { height: 52, borderRadius: 10, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});