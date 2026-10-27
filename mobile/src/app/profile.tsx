import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { api, PlantList } from "../api";
import { session, roleLabel, logout as clearSession } from "../session";
import { C, F } from "../theme";
import { BottomNav } from "../components";

export default function Profile() {
  const [stats, setStats] = useState({ total: 0, published: 0, research: 0 });
  const user = session.user;

  useFocusEffect(useCallback(() => {
    api<PlantList>("/api/plants?mine=true&limit=100")
      .then((d) => {
        const published = d.plants.filter((p) => p.publication_status === "Published").length;
        setStats({ total: d.total, published, research: d.plants.length - published });
      })
      .catch(() => {});
  }, []));

  const name = user?.full_name || "Botanist";
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const logout = () =>
    Alert.alert("Log out?", "You'll need to log in again to register or scan plants.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: () => { clearSession(); router.replace("/"); },
      },
    ]);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Profile</Text>

        <View style={s.userCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.email}>{user?.email}</Text>
            <View style={s.rolePill}>
              <Ionicons name="leaf-outline" size={12} color={C.green} />
              <Text style={s.roleText}>{roleLabel(user)}</Text>
            </View>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statNum}>{stats.total}</Text>
            <Text style={s.statLabel}>My plants</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.orange }]}>{stats.research}</Text>
            <Text style={s.statLabel}>Under Research</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.green }]}>{stats.published}</Text>
            <Text style={s.statLabel}>Published</Text>
          </View>
        </View>

        <View style={s.menu}>
          <Pressable style={[s.menuRow, s.menuLine]} onPress={() => router.push("/change-password")}>
            <Ionicons name="key-outline" size={20} color={C.green} />
            <Text style={s.menuText}>Change password</Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
          <Pressable style={[s.menuRow, s.menuLine]} onPress={() => router.push("/requests")}>
            <Ionicons name="git-pull-request-outline" size={20} color={C.green} />
            <Text style={s.menuText}>My requests</Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
          <Pressable
            style={s.menuRow}
            onPress={() => Alert.alert("RimbaTag", "Smart Ground-Truthing & Digital Biodiversity System\nNiah National Park · SFC\nVersion 0.3 (Sprint 2)")}
          >
            <Ionicons name="information-circle-outline" size={20} color={C.green} />
            <Text style={s.menuText}>About this app</Text>
            <Ionicons name="chevron-forward" size={18} color={C.faint} />
          </Pressable>
        </View>

        <Pressable style={s.logout} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color="#B3261E" />
          <Text style={s.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={s.footer}>Niah National Park · Sarawak Forestry Corporation</Text>
      </ScrollView>

      <BottomNav current="profile" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 24, gap: 16 },
  title: { fontFamily: F.title, fontSize: 22, color: C.text },
  userCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: C.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.line },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.green, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: F.title, fontSize: 22, color: C.bg },
  name: { fontFamily: F.semi, fontSize: 17, color: C.text },
  email: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: C.greenSoft, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, marginTop: 8 },
  roleText: { fontFamily: F.semi, fontSize: 12, color: C.green },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: C.white, borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: C.line },
  statNum: { fontFamily: F.title, fontSize: 24, color: C.text },
  statLabel: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2, textAlign: "center" },
  menu: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  menuLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  menuText: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.text },
  logout: { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: "#B3261E", backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { fontFamily: F.semi, fontSize: 15, color: "#B3261E" },
  footer: { fontFamily: F.body, fontSize: 12, color: C.faint, textAlign: "center", marginTop: 4 },
});
