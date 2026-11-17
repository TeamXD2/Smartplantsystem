import { useRef, useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator,
  ImageBackground, ScrollView, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { api, User } from "../api";
import { session, isBotanist, logout } from "../session";
import { C, F } from "../theme";

const CAVE = require("../../assets/images/niah-cave.jpg");
const DANGER = "#B3261E";

export default function Login() {
  const [mode, setMode] = useState<"choose" | "login">("choose");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState<"" | "email" | "password">("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const openLogin = () => {
    setMessage(null);
    setMode("login");
  };

  const goBack = () => {
    setMessage(null);
    setEmailError("");
    setPasswordError("");
    setMode("choose");
  };

  const login = async () => {
    const trimmed = email.trim();
    const eError = !trimmed ? "Enter your email" : !/^\S+@\S+\.\S+$/.test(trimmed) ? "That doesn't look like an email address" : "";
    const pError = !password ? "Enter your password" : "";
    setEmailError(eError);
    setPasswordError(pError);
    setMessage(null);
    if (eError || pError) return;
    setLoading(true);
    try {
      const data = await api<{ token: string; user: User }>("/api/auth/login", {
        method: "POST",
        body: { email: trimmed, password },
      });
      // The mobile app is for Botanists. Officers and Admins work on the website.
      if (!isBotanist(data.user)) {
        logout();
        return setMessage({
          kind: "info",
          text: `This is ${data.user.role_name === "Admin" ? "an Admin" : "an Officer"} account. Please use the RimbaTag website. The app is for botanists in the field.`,
        });
      }
      session.token = data.token;
      session.user = data.user;
      router.replace("/home");
    } catch (e: any) {
      const text =
        e.status === 401 ? "Wrong email or password. Please check and try again."
        : e.status === 0 ? "Can't connect. Check your internet or Wi-Fi and try again."
        : e.message;
      setMessage({ kind: "error", text });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={s.safe} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" bounces={false}>
        <ImageBackground source={CAVE} style={[s.hero, mode === "login" && s.heroSmall]} resizeMode="cover">
          <View style={s.shade} />
          <SafeAreaView edges={["top"]} style={s.heroInner}>
            <View style={s.brand}>
              <Ionicons name="leaf-outline" size={20} color={C.bg} />
              <Text style={s.brandText}>RimbaTag</Text>
            </View>
            <View>
              <Text style={s.headline}>Every plant in Niah, tagged and protected</Text>
              <Text style={s.caption}>Niah Cave, Niah National Park</Text>
            </View>
          </SafeAreaView>
        </ImageBackground>

        <View style={s.body}>
          {mode === "choose" ? (
            <View style={s.card}>
              <Text style={s.cardTitle}>Welcome</Text>
              <Text style={s.cardSub}>How would you like to continue?</Text>

              <Pressable style={[s.primary, { marginTop: 0 }]} onPress={openLogin} accessibilityRole="button">
                <Ionicons name="person-outline" size={18} color={C.white} />
                <Text style={s.primaryText}>Staff login</Text>
              </Pressable>
              <Text style={s.hint}>For SFC botanists registering and updating plants</Text>

              <Pressable style={s.secondary} onPress={() => router.replace("/explore")} accessibilityRole="button">
                <Ionicons name="leaf-outline" size={18} color={C.green} />
                <Text style={s.secondaryText}>Explore as a visitor</Text>
              </Pressable>
              <Text style={s.hint}>Browse plants and scan tags. No account needed.</Text>
            </View>
          ) : (
            <View style={s.card}>
              <Text style={s.cardTitle}>Staff login</Text>
              <Text style={s.cardSub}>Use the email and password your Admin gave you.</Text>

              {message && (
                <View style={[s.banner, message.kind === "info" && s.bannerInfo]}>
                  <Ionicons
                    name={message.kind === "error" ? "alert-circle-outline" : "information-circle-outline"}
                    size={18}
                    color={message.kind === "error" ? DANGER : C.green}
                  />
                  <Text style={[s.bannerText, message.kind === "info" && { color: C.green }]}>{message.text}</Text>
                </View>
              )}

              <Text style={s.label}>Email</Text>
              <TextInput
                style={[s.input, focused === "email" && s.inputFocus, !!emailError && s.inputError]}
                placeholder="you@sfc.gov.my"
                placeholderTextColor={C.faint}
                value={email}
                onChangeText={(t) => { setEmail(t); setEmailError(""); setMessage(null); }}
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused("")}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                accessibilityLabel="Email"
              />
              {!!emailError && <Text style={s.fieldError}>{emailError}</Text>}

              <Text style={s.label}>Password</Text>
              <View style={[s.passwordBox, focused === "password" && s.inputFocus, !!passwordError && s.inputError]}>
                <TextInput
                  ref={passwordRef}
                  style={s.passwordInput}
                  placeholder="Your password"
                  placeholderTextColor={C.faint}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setPasswordError(""); setMessage(null); }}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused("")}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={login}
                  accessibilityLabel="Password"
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} hitSlop={12}
                  accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={22} color={C.muted} />
                </Pressable>
              </View>
              {!!passwordError && <Text style={s.fieldError}>{passwordError}</Text>}

              <Pressable style={[s.primary, loading && { opacity: 0.7 }]} onPress={login} disabled={loading}>
                {loading && <ActivityIndicator color={C.white} />}
                <Text style={s.primaryText}>{loading ? "Logging in..." : "Log in"}</Text>
              </Pressable>
              <Text style={s.note}>Forgot your password or no account yet?{"\n"}Ask your Admin to reset or create one.</Text>

              <Pressable style={s.back} onPress={goBack} hitSlop={12} accessibilityRole="button">
                <Ionicons name="arrow-back" size={16} color={C.green} />
                <Text style={s.backText}>Back</Text>
              </Pressable>
            </View>
          )}

          <View style={{ flex: 1 }} />
          <Text style={s.footer}>Niah National Park · Sarawak Forestry Corporation</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  hero: { height: 420, justifyContent: "flex-end" },
  heroSmall: { height: 290 },
  shade: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(15,29,23,0.45)" },
  heroInner: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24, paddingTop: 12, paddingBottom: 44 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  brandText: { fontFamily: F.title, fontSize: 18, color: C.bg },
  headline: { fontFamily: F.title, fontSize: 28, lineHeight: 34, color: C.bg },
  caption: { fontFamily: F.body, fontSize: 12, color: C.bg, opacity: 0.85, marginTop: 6 },
  body: { flex: 1, paddingHorizontal: 18, paddingBottom: 20, marginTop: -26 },
  card: { backgroundColor: C.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: C.line },
  cardTitle: { fontFamily: F.title, fontSize: 22, color: C.text, marginBottom: 4 },
  cardSub: { fontFamily: F.body, fontSize: 14, color: C.muted, marginBottom: 18 },
  primary: { height: 54, borderRadius: 12, backgroundColor: C.orange, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 18 },
  primaryText: { fontFamily: F.semi, fontSize: 16, color: C.white },
  secondary: { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: C.green, backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  secondaryText: { fontFamily: F.semi, fontSize: 16, color: C.green },
  hint: { fontFamily: F.body, fontSize: 12, color: C.muted, textAlign: "center", marginTop: 6 },
  label: { fontFamily: F.semi, fontSize: 14, color: C.text, marginBottom: 6, marginTop: 12 },
  input: { height: 52, color: C.text, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 15, fontFamily: F.body, backgroundColor: C.white },
  passwordBox: { height: 52, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, backgroundColor: C.white, flexDirection: "row", alignItems: "center", gap: 8 },
  inputFocus: { borderColor: C.green, borderWidth: 2 },
  inputError: { borderColor: DANGER, borderWidth: 2 },
  fieldError: { fontFamily: F.body, fontSize: 13, color: DANGER, marginTop: 4 },
  banner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FDE7E5", borderRadius: 10, padding: 12, marginBottom: 4 },
  bannerInfo: { backgroundColor: C.greenSoft },
  bannerText: { flex: 1, fontFamily: F.body, fontSize: 14, color: DANGER, lineHeight: 20 },
  passwordInput: { flex: 1, fontSize: 15, fontFamily: F.body, color: C.text },
  note: { fontFamily: F.body, fontSize: 13, color: C.muted, textAlign: "center", marginTop: 14, lineHeight: 19 },
  back: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 },
  backText: { fontFamily: F.semi, fontSize: 14, color: C.green },
  footer: { fontFamily: F.body, fontSize: 12, color: C.faint, textAlign: "center", marginTop: 20 },
});
