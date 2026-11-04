import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api } from "../api";
import { session } from "../session";
import { C, F } from "../theme";

// Admins and Conservation Officers need 12 characters, everyone else 8 (the backend enforces this and
// also refuses very common passwords and ones that contain the person's name or email).
const STRONG_ROLES = ["Admin", "Conservation Officer"];

// Same as "My Account -> Change password" on the website (PATCH /api/auth/password).
export default function ChangePassword() {
  const minLength = STRONG_ROLES.includes(session.user?.role_name ?? "") ? 12 : 8;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!current || !next) return Alert.alert("Missing info", "Fill in your current and new password.");
    if (next.length < minLength || next.length > 72) return Alert.alert("Wrong length", `The new password must be ${minLength} to 72 characters.`);
    if (next !== confirm) return Alert.alert("Doesn't match", "The new passwords do not match.");
    setSaving(true);
    try {
      const data = await api<{ token?: string }>("/api/auth/password", { method: "PATCH", body: { current_password: current, new_password: next } });
      // Changing the password ends every other login; the backend sends this one a fresh token.
      if (data.token) session.token = data.token;
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
        <Text style={s.hint}>{`${minLength} to 72 characters. Very common passwords are refused.`}</Text>
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
