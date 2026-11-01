import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "../api";
import { C, F } from "../theme";

// Same as "My Account -> Change password" on the website (PATCH /api/auth/password).
export default function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!current || !next) return Alert.alert("Missing info", "Fill in your current and new password.");
    if (next.length < 8 || next.length > 72) return Alert.alert("Too short", "The new password must be 8 to 72 characters.");
    if (next !== confirm) return Alert.alert("Doesn't match", "The new passwords do not match.");
    setSaving(true);
    try {
      await api("/api/auth/password", { method: "PATCH", body: { current_password: current, new_password: next } });
      Alert.alert("Password changed", "Use the new password next time you log in.");
      router.back();
    } catch (e: any) {
      Alert.alert("Could not change", e.message);
      setSaving(false);
    }
  };

  const field = (label: string, value: string, set: (t: string) => void) => (
    <View>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={set} secureTextEntry placeholder="••••••••" placeholderTextColor={C.faint} />
    </View>
  );

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>Change Password</Text>
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {field("Current password", current, setCurrent)}
        {field("New password", next, setNext)}
        <Text style={s.hint}>8 to 72 characters.</Text>
        {field("Confirm new password", confirm, setConfirm)}
        <Pressable style={[s.button, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator color={C.white} /> : <Text style={s.buttonText}>Change Password</Text>}
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
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 15, fontFamily: F.body, backgroundColor: C.white, marginBottom: 16, color: C.text },
  hint: { fontFamily: F.body, fontSize: 12, color: C.faint, marginTop: -10, marginBottom: 14 },
  button: { height: 52, borderRadius: 10, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});
