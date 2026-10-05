import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { C, F } from "../theme";
   import { session } from "../session";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.container}>
        <View style={{ flex: 1 }} />

        <View style={s.brand}>
          <View style={s.logo}>
            <Ionicons name="leaf-outline" size={32} color={C.bg} />
          </View>
          <Text style={s.title}>Ground-Truthing</Text>
          <Text style={s.subtitle}>Smart Digital Biodiversity System</Text>
        </View>

        <Text style={s.label}>Email</Text>
        <TextInput style={s.input} placeholder="you@sfc.gov.my" placeholderTextColor={C.faint}
          value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />

        <Text style={s.label}>Password</Text>
        <TextInput style={s.input} placeholder="••••••••" placeholderTextColor={C.faint}
          value={password} onChangeText={setPassword} secureTextEntry />

        <Text style={s.forgot}>Forgot password?</Text>

        <Pressable style={s.button}    onPress={() => { session.email = email.trim(); router.replace("/home"); }}>
          <Text style={s.buttonText}>Log In</Text>
        </Pressable>

        <Text style={s.role}>Role: <Text style={s.roleBold}>Botanist</Text></Text>

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
  forgot: { fontFamily: F.semi, fontSize: 13, color: C.green, alignSelf: "flex-end" },
  button: { height: 52, borderRadius: 10, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", marginTop: 22 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
  role: { fontFamily: F.body, fontSize: 13, color: C.muted, textAlign: "center", marginTop: 22 },
  roleBold: { fontFamily: F.semi, color: C.text },
  footer: { fontFamily: F.body, fontSize: 12, color: C.faint, textAlign: "center" },
});