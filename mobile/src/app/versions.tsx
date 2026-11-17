import { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { api, FIELD_LABELS, PlantVersion, PlantVersions } from "../api";
import { C, F } from "../theme";

const FIELDS = [
  "scientific_name", "common_name", "family", "genus", "species",
  "height_cm", "width_cm", "morphological_notes", "surrounding_environment",
  "latitude", "longitude", "conservation_status", "ecological_role",
  "medicinal_use", "cultural_significance",
];

const SOURCE_LABELS: Record<string, string> = {
  REGISTER: "Original registration",
  EDIT: "Direct edit",
  REQUEST: "Approved edit request",
  BACKFILL: "Saved when versions were introduced",
};

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function same(a: unknown, b: unknown) {
  if (isEmpty(a) && isEmpty(b)) return true;
  if (isEmpty(a) || isEmpty(b)) return false;
  if (!Number.isNaN(Number(a)) && !Number.isNaN(Number(b))) return Number(a) === Number(b);
  return String(a) === String(b);
}

const show = (v: unknown) => (isEmpty(v) ? "(empty)" : String(v));

function roleLabel(role?: string | null, botanistType?: string | null) {
  if (!role) return "";
  return role === "Botanist" && botanistType ? `${botanistType} Botanist` : role;
}

function exactTime(iso: string) {
  return new Date(iso).toLocaleString([], { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function changedFields(version: PlantVersion, previous?: PlantVersion) {
  if (!previous) return [];
  return FIELDS.filter((f) => !same(version[f], previous[f]));
}

export default function Versions() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [data, setData] = useState<PlantVersions | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const [allFields, setAllFields] = useState(false);

  useFocusEffect(useCallback(() => {
    api<PlantVersions>(`/api/plants/${id}/versions`)
      .then((d) => {
        setData(d);
        setOpen(d.versions[0]?.version_id ?? null);
      })
      .catch((e) => setError(e.status === 403 ? "You don't have access to this plant's versions." : e.message));
  }, [id]));

  const header = (
    <View style={s.header}>
      <Pressable style={s.back} onPress={() => (router.canGoBack() ? router.back() : router.replace("/home"))}>
        <Ionicons name="chevron-back" size={22} color={C.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.headerTitle}>Versions</Text>
        {!!name && <Text style={s.headerSub} numberOfLines={1}>{name}</Text>}
      </View>
    </View>
  );

  if (!data) {
    return (
      <SafeAreaView style={s.safe}>
        {header}
        <View style={s.centerBox}>
          {error ? (
            <>
              <Ionicons name="alert-circle-outline" size={40} color={C.orange} />
              <Text style={s.errorText}>{error}</Text>
            </>
          ) : (
            <ActivityIndicator color={C.green} />
          )}
        </View>
      </SafeAreaView>
    );
  }

  const versions = data.versions;
  const rejected = data.rejected_requests || [];

  return (
    <SafeAreaView style={s.safe}>
      {header}
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.intro}>
          Every change is saved as a new version, so earlier records are never overwritten. Tap a version to see what changed.
        </Text>

        {versions.length === 0 && (
          <View style={s.card}><Text style={s.muted}>No versions saved yet.</Text></View>
        )}

        {versions.map((v, i) => {
          const previous = versions[i + 1];
          const changes = changedFields(v, previous);
          const isOpen = open === v.version_id;
          const isCurrent = i === 0;
          const isOriginal = v.version_no === 1 && v.source === "REGISTER";
          const registered = v.source === "REGISTER" || v.source === "BACKFILL";
          const who = v.changed_by_name || "Unknown";
          const role = roleLabel(v.changed_by_role, v.changed_by_botanist_type);
          const rows = allFields || !previous ? FIELDS.filter((f) => allFields || !isEmpty(v[f])) : changes;

          return (
            <View key={v.version_id} style={s.timelineItem}>
              <View style={s.rail}>
                <View style={[s.dot, isCurrent && s.dotCurrent]} />
                {i < versions.length - 1 && <View style={s.railLine} />}
              </View>

              <Pressable style={[s.card, s.versionCard, isOpen && s.cardOpen]} onPress={() => setOpen(isOpen ? null : v.version_id)}>
                <View style={s.versionTop}>
                  <Text style={s.versionNo}>v{v.version_no}</Text>
                  {isCurrent && <Text style={[s.badge, s.badgeCurrent]}>CURRENT</Text>}
                  {isOriginal && <Text style={[s.badge, s.badgeOriginal]}>ORIGINAL</Text>}
                  <View style={{ flex: 1 }} />
                  <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={C.muted} />
                </View>

                <Text style={s.who}>
                  {registered ? "Registered by " : "Changed by "}{who}
                  {!!role && <Text style={s.muted}> · {role}</Text>}
                </Text>
                {!!v.approved_by_name && <Text style={s.small}>Approved by {v.approved_by_name}</Text>}
                <Text style={s.small}>
                  {SOURCE_LABELS[v.source] || v.source}{v.request_id ? ` (request #${v.request_id})` : ""} · {exactTime(v.created_at)}
                </Text>
                {!!previous && (
                  <Text style={s.changeCount}>
                    {changes.length === 0 ? "No field changes" : `${changes.length} field${changes.length === 1 ? "" : "s"} changed`}
                  </Text>
                )}
                {!!v.note && <Text style={s.note}>"{v.note}"</Text>}

                {isOpen && (
                  <View style={s.details}>
                    <Pressable style={s.toggle} onPress={() => setAllFields(!allFields)} hitSlop={8}>
                      <Ionicons name={allFields ? "checkbox" : "square-outline"} size={18} color={C.green} />
                      <Text style={s.toggleText}>Show all fields</Text>
                    </Pressable>

                    {rows.length === 0 && <Text style={s.muted}>Nothing changed in the plant fields.</Text>}

                    {rows.map((f) => {
                      const changed = !!previous && !same(v[f], previous[f]);
                      return (
                        <View key={f} style={[s.fieldRow, changed && s.fieldChanged]}>
                          <Text style={s.fieldLabel}>{FIELD_LABELS[f] || f}</Text>
                          {changed ? (
                            <View style={s.diff}>
                              <Text style={s.oldValue}>{show(previous![f])}</Text>
                              <Ionicons name="arrow-forward" size={14} color={C.muted} />
                              <Text style={s.newValue}>{show(v[f])}</Text>
                            </View>
                          ) : (
                            <Text style={[s.fieldValue, isEmpty(v[f]) && s.muted]}>{show(v[f])}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </Pressable>
            </View>
          );
        })}

        {rejected.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Rejected edit requests ({rejected.length})</Text>
            {rejected.map((r, i) => (
              <View key={r.request_id} style={[s.rejected, i > 0 && s.rowLine]}>
                <Text style={s.who}>
                  {r.requested_by_name || "Unknown"}
                  <Text style={s.muted}> · {roleLabel(r.requested_by_role, r.requested_by_botanist_type)}</Text>
                </Text>
                <Text style={s.small}>
                  {r.request_type === "DELETE" ? "Delete request" : "Edit request"} · rejected{r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}
                  {r.reviewed_at ? ` · ${exactTime(r.reviewed_at)}` : ""}
                </Text>
                {r.proposed_changes && Object.keys(r.proposed_changes).length > 0 && (
                  <Text style={s.small}>
                    Proposed: {Object.entries(r.proposed_changes).map(([k, val]) => `${FIELD_LABELS[k] || k} → ${show(val)}`).join(", ")}
                  </Text>
                )}
                {!!r.review_comment && <Text style={s.note}>"{r.review_comment}"</Text>}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontFamily: F.title, fontSize: 22, color: C.text },
  headerSub: { fontFamily: F.body, fontSize: 13, color: C.muted, fontStyle: "italic" },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
  errorText: { fontFamily: F.semi, fontSize: 15, color: C.text, textAlign: "center" },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
  intro: { fontFamily: F.body, fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 4 },
  card: { backgroundColor: C.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.line },
  cardOpen: { borderColor: C.green },
  cardTitle: { fontFamily: F.semi, fontSize: 14, color: C.text, marginBottom: 6 },
  timelineItem: { flexDirection: "row", gap: 10 },
  rail: { width: 16, alignItems: "center" },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: C.green, backgroundColor: C.white, marginTop: 18 },
  dotCurrent: { backgroundColor: C.green },
  railLine: { flex: 1, width: 2, backgroundColor: C.border, marginTop: 2, marginBottom: -14 },
  versionCard: { flex: 1, gap: 3 },
  versionTop: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  versionNo: { fontFamily: F.title, fontSize: 18, color: C.text },
  badge: { fontFamily: F.semi, fontSize: 10, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: "hidden" },
  badgeCurrent: { backgroundColor: C.green, color: C.white },
  badgeOriginal: { backgroundColor: C.orangeSoft, color: C.orange },
  who: { fontFamily: F.semi, fontSize: 14, color: C.text },
  small: { fontFamily: F.body, fontSize: 12, color: C.muted },
  muted: { fontFamily: F.body, color: C.muted },
  changeCount: { fontFamily: F.semi, fontSize: 12, color: C.orange, marginTop: 2 },
  note: { fontFamily: F.body, fontSize: 13, color: C.text, fontStyle: "italic", marginTop: 2 },
  details: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.line, gap: 6 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  toggleText: { fontFamily: F.semi, fontSize: 13, color: C.green },
  fieldRow: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: C.bg },
  fieldChanged: { backgroundColor: C.orangeSoft },
  fieldLabel: { fontFamily: F.body, fontSize: 12, color: C.muted, marginBottom: 2 },
  fieldValue: { fontFamily: F.semi, fontSize: 14, color: C.text },
  diff: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  oldValue: { fontFamily: F.body, fontSize: 14, color: "#B3261E", textDecorationLine: "line-through" },
  newValue: { fontFamily: F.semi, fontSize: 14, color: C.green },
  rejected: { paddingVertical: 8, gap: 2 },
  rowLine: { borderTopWidth: 1, borderTopColor: C.line },
});
