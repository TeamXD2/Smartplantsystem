import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getPlants } from "../db";
import { session } from "../session";
import { C, F } from "../theme";
import { BottomNav } from "../components";

export default function Profile() {
  const [stats, setStats] = useState({ total: 0, synced: 0, pending: 0 });

  // Recount every time this screen opens
  useFocusEffect(useCallback(() => {
    const all = getPlants();
    const synced = all.filter((p) => p.synced).length;
    setStats({ total: all.length, synced, pending: all.length - synced });
  }, []));

  const email = session.email || "botanist@sfc.gov.my";
  const name = email.split("@")[0];
  const initials = name.slice(0, 2).toUpperCase();

  const logout = () =>
    Alert.alert("Log out?", "Records saved on this phone will stay.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: () => { session.email = ""; router.replace("/"); } },
    ]);

  const menu = [
    { icon: "sync-outline", label: "Sync records", onPress: () => Alert.alert("Sync", "Coming soon. Waiting for the team backend.") },
    { icon: "notifications-outline", label: "Notifications", onPress: () => Alert.alert("Notifications", "Coming soon.") },
    { icon: "information-circle-outline", label: "About this app", onPress: () => Alert.alert("Ground-Truthing", "Smart Digital Biodiversity System\nNiah National Park · SFC\nVersion 0.1 (Sprint 1)") },
  ] as const;

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.title}>Profile</Text>

        {/* User card */}
        <View style={s.userCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{name}</Text>
            <Text style={s.email}>{email}</Text>
            <View style={s.rolePill}>
              <Ionicons name="leaf-outline" size={12} color={C.green} />
              <Text style={s.roleText}>{session.role}</Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.stat}>
            <Text style={s.statNum}>{stats.total}</Text>
            <Text style={s.statLabel}>Records</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.green }]}>{stats.synced}</Text>
            <Text style={s.statLabel}>Synced</Text>
          </View>
          <View style={s.stat}>
            <Text style={[s.statNum, { color: C.orange }]}>{stats.pending}</Text>
            <Text style={s.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Menu */}
        <View style={s.menu}>
          {menu.map((m, i) => (
            <Pressable key={m.label} style={[s.menuRow, i < menu.length - 1 && s.menuLine]} onPress={m.onPress}>
              <Ionicons name={m.icon} size={20} color={C.green} />
              <Text style={s.menuText}>{m.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={C.faint} />
            </Pressable>
          ))}
        </View>

        {/* Log out */}
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
  name: { fontFamily: F.semi, fontSize: 17, color: C.text, textTransform: "capitalize" },
  email: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
  rolePill: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: C.greenSoft, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, marginTop: 8 },
  roleText: { fontFamily: F.semi, fontSize: 12, color: C.green },
  statsRow: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, backgroundColor: C.white, borderRadius: 14, paddingVertical: 16, alignItems: "center", borderWidth: 1, borderColor: C.line },
  statNum: { fontFamily: F.title, fontSize: 24, color: C.text },
  statLabel: { fontFamily: F.body, fontSize: 12, color: C.muted, marginTop: 2 },
  menu: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.line, paddingHorizontal: 16 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 16 },
  menuLine: { borderBottomWidth: 1, borderBottomColor: C.line },
  menuText: { flex: 1, fontFamily: F.semi, fontSize: 15, color: C.text },
  logout: { height: 52, borderRadius: 12, borderWidth: 1.5, borderColor: "#B3261E", backgroundColor: C.white, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  logoutText: { fontFamily: F.semi, fontSize: 15, color: "#B3261E" },
  footer: { fontFamily: F.body, fontSize: 12, color: C.faint, textAlign: "center", marginTop: 4 },
});