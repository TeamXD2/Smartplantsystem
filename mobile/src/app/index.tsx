import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, User } from "../api";
import { session, isBotanist, logout } from "../session";
import { C, F } from "../theme";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    if (!email.trim() || !password) {
      return Alert.alert("Missing info", "Please enter your email and password.");
    }
    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: { email: email.trim(), password },
      });
      // The mobile app is for Botanists. Officers and Admins work on the website.
      if (!isBotanist(data.user)) {
        logout();
        return Alert.alert(
          "Please use the website",
          `${data.user.role_name} accounts manage records on the RimbaTag website. The mobile app is for Botanists in the field.`
        );
      }
      session.token = data.token;
      session.user = data.user;
      router.replace("/home");
    } catch (e: any) {
      Alert.alert("Login failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={{ flex: 1 }} />

        <View style={s.brand}>
          <View style={s.logo}>
            <Ionicons name="leaf-outline" size={32} color={C.bg} />
          </View>
          <Text style={s.title}>RimbaTag</Text>
          <Text style={s.subtitle}>Smart Ground-Truthing · Niah National Park</Text>
        </View>

        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} placeholder="you@sfc.gov.my" placeholderTextColor={C.faint}
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={s.label}>Password</Text>
        <TextInput style={s.input} placeholder="••••••••" placeholderTextColor={C.faint}
          value={password} onChangeText={setPassword} secureTextEntry onSubmitEditing={login} />

        <Pressable style={[s.button, loading && { opacity: 0.7 }]} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color={C.white} /> : <Text style={s.buttonText}>Log In</Text>}
        </Pressable>

        <Text style={s.note}>No account? Ask your Admin to create one.</Text>

        {/* Park visitors don't need an account */}
        <Pressable style={s.visitor} onPress={() => router.replace("/explore")}>
          <Ionicons name="leaf-outline" size={18} color={C.green} />
          <Text style={s.visitorText}>Explore as a visitor</Text>
        </Pressable>

        <View style={{ flex: 1.4 }} />
        <Text style={s.footer}>Niah National Park · Sarawak Forestry Corporation</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 28, paddingBottom: 20 },
  brand: { alignItems: "center", gap: 14, marginBottom: 40 },
  logo: { width: 64, height: 64, borderRadius: 18, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.title, fontSize: 24, color: C.text },
  subtitle: { fontFamily: F.body, fontSize: 14, color: C.muted },
  label: { fontFamily: F.semi, fontSize: 13, color: C.text, marginBottom: 6 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 15, fontFamily: F.body, backgroundColor: C.white, marginBottom: 16 },
  button: { height: 52, borderRadius: 10, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted, textAlign: "center", marginTop: 20 },
  visitor: { height: 52, borderRadius: 10, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  visitorText: { fontFamily: F.semi, fontSize: 15, color: C.green },
  footer: { fontFamily: F.body, fontSize: 12, color: C.faint, textAlign: "center" },
});
