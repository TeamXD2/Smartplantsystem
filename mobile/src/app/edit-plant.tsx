import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, router } from "expo-router";
import { api, PlantDetail, PLANT_FIELDS } from "../api";
import { session, isExternal } from "../session";
import { C, F } from "../theme";

// Edit a record, the same way as the website:
//   Internal Botanist -> saved straight away (PATCH /api/plants/:id)
//   External Botanist -> sent as an edit request for an Officer (POST /api/requests)
// Only the fields that changed are sent.
type Field = (typeof PLANT_FIELDS)[number];
const NUMERIC: Field[] = ["height_cm", "width_cm"];

const FORM: { key: Field; label: string; placeholder?: string; multiline?: boolean; numeric?: boolean }[] = [
  { key: "scientific_name", label: "Scientific name *" },
  { key: "common_name", label: "Common name" },
  { key: "family", label: "Family" },
  { key: "genus", label: "Genus" },
  { key: "species", label: "Species" },
  { key: "height_cm", label: "Height (cm)", numeric: true },
  { key: "width_cm", label: "Width (cm)", numeric: true },
  { key: "morphological_notes", label: "Description / features", multiline: true },
];

// "50.00" -> "50" so the form shows what the botanist typed
function asText(v: unknown) {
  if (v === null || v === undefined) return "";
  const t = String(v);
  return /^\d+\.\d+$/.test(t) ? String(Number(t)) : t;
}

export default function EditPlant() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const external = isExternal(session.user);
  const [original, setOriginal] = useState<Record<Field, string> | null>(null);
  const [values, setValues] = useState<Record<Field, string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<PlantDetail>(`/api/plants/${id}`)
      .then((p) => {
        const v = Object.fromEntries(PLANT_FIELDS.map((f) => [f, asText((p as any)[f])])) as Record<Field, string>;
        setOriginal(v);
        setValues(v);
      })
      .catch((e) => { Alert.alert("Could not load", e.message); router.back(); });
  }, [id]);

  const save = async () => {
    if (!values || !original) return;
    if (!values.scientific_name.trim()) return Alert.alert("Missing info", "Scientific name is required.");

    const changes: Record<string, string | number | null> = {};
    for (const f of PLANT_FIELDS) {
      if (values[f].trim() === original[f].trim()) continue;
      const text = values[f].trim();
      if (NUMERIC.includes(f) && text !== "") {
        const n = Number(text);
        if (isNaN(n) || n < 0 || n > 9999.99) return Alert.alert("Invalid number", "Height and width must be 0 to 9999.99 cm.");
        changes[f] = n;
      } else {
        changes[f] = text === "" ? null : text;
      }
    }
    if (Object.keys(changes).length === 0) return Alert.alert("Nothing changed", "Change a field first.");

    setSaving(true);
    try {
      if (external) {
        await api("/api/requests", { method: "POST", body: { plant_id: Number(id), request_type: "EDIT", proposed_changes: changes } });
        Alert.alert("Request sent", "An Officer will review your changes. Follow it in the Requests tab.");
      } else {
        await api(`/api/plants/${id}`, { method: "PATCH", body: changes });
        Alert.alert("Saved", "Your changes were saved.");
      }
      router.back();
    } catch (e: any) {
      Alert.alert("Could not save", e.message);
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable style={s.back} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={22} color={C.text} />
        </Pressable>
        <Text style={s.title}>{external ? "Request an Edit" : "Edit Record"}</Text>
      </View>

      {!values ? (
        <ActivityIndicator color={C.green} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={s.content}>
          {external && (
            <Text style={s.notice}>As an External Botanist your changes are sent to an Officer, who approves or rejects them.</Text>
          )}
          {FORM.map((f) => (
            <View key={f.key}>
              <Text style={s.label}>{f.label}</Text>
              <TextInput
                style={[s.input, f.multiline && { height: 90, paddingTop: 12, textAlignVertical: "top" }]}
                value={values[f.key]}
                onChangeText={(t) => setValues((v) => ({ ...v!, [f.key]: t }))}
                keyboardType={f.numeric ? "numeric" : "default"}
                autoCapitalize={f.key === "species" ? "none" : "sentences"}
                multiline={f.multiline}
                maxLength={f.multiline ? undefined : 150}
              />
            </View>
          ))}
          <Pressable style={[s.button, saving && { opacity: 0.7 }]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color={C.white} /> : <Text style={s.buttonText}>{external ? "Send Edit Request" : "Save Changes"}</Text>}
          </Pressable>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: F.title, fontSize: 22, color: C.text },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  notice: { fontFamily: F.body, fontSize: 13, color: C.orange, backgroundColor: C.orangeSoft, padding: 12, borderRadius: 10, marginBottom: 16 },
  label: { fontFamily: F.semi, fontSize: 13, color: C.text, marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 14, fontSize: 15, fontFamily: F.body, backgroundColor: C.white, marginBottom: 16, color: C.text },
  button: { height: 52, borderRadius: 10, backgroundColor: C.orange, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { fontFamily: F.semi, fontSize: 16, color: C.white },
});
