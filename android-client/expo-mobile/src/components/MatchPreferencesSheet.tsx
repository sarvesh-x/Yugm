import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Check, Minus, Plus, SlidersHorizontal, X } from "lucide-react-native";
import { colors, gradients, radii } from "@/theme/colors";

export type MatchPreferences = {
  interestedIn: "Everyone" | "Women" | "Men" | "Non-binary";
  lookingFor: "Friendship" | "Dating" | "Relationship" | "Networking";
  datingAgeMin: number;
  datingAgeMax: number;
  verifiedOnly: boolean;
};

export function MatchPreferencesSheet({ visible, initial, saving, onClose, onSave }: {
  visible: boolean;
  initial?: MatchPreferences;
  saving?: boolean;
  onClose: () => void;
  onSave: (preferences: MatchPreferences) => void;
}) {
  const [value, setValue] = useState<MatchPreferences>(initial ?? defaults);
  useEffect(() => { if (initial) setValue(initial); }, [initial, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close preferences" />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.titleRow}><View style={styles.icon}><SlidersHorizontal color={colors.pink} size={19} /></View><View><Text style={styles.title}>Shape your deck</Text><Text style={styles.subtitle}>You stay in control of who you discover.</Text></View></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}><X color={colors.text} size={19} /></Pressable>
          </View>
          {!initial ? <ActivityIndicator color={colors.pink} style={{ marginVertical: 50 }} /> : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
              <PreferenceGroup title="I'm interested in">
                <ChoiceRow options={["Everyone", "Women", "Men", "Non-binary"]} selected={value.interestedIn} onSelect={(interestedIn) => setValue({ ...value, interestedIn: interestedIn as MatchPreferences["interestedIn"] })} />
              </PreferenceGroup>
              <PreferenceGroup title="I'm looking for">
                <ChoiceRow options={["Friendship", "Dating", "Relationship", "Networking"]} selected={value.lookingFor} onSelect={(lookingFor) => setValue({ ...value, lookingFor: lookingFor as MatchPreferences["lookingFor"] })} />
              </PreferenceGroup>
              <PreferenceGroup title="Age range">
                <View style={styles.ageRow}>
                  <AgeControl label="Minimum" value={value.datingAgeMin} onChange={(datingAgeMin) => setValue({ ...value, datingAgeMin: Math.min(datingAgeMin, value.datingAgeMax) })} />
                  <View style={styles.ageDash} />
                  <AgeControl label="Maximum" value={value.datingAgeMax} onChange={(datingAgeMax) => setValue({ ...value, datingAgeMax: Math.max(datingAgeMax, value.datingAgeMin) })} />
                </View>
              </PreferenceGroup>
              <View style={styles.verifyRow}><View style={{ flex: 1 }}><Text style={styles.verifyTitle}>Verified profiles only</Text><Text style={styles.verifyCopy}>Prioritize people who completed Yugm Trust Verification.</Text></View><Switch value={value.verifiedOnly} onValueChange={(verifiedOnly) => setValue({ ...value, verifiedOnly })} trackColor={{ false: colors.line, true: "rgba(255,62,147,0.45)" }} thumbColor={value.verifiedOnly ? colors.pink : colors.muted} /></View>
              <Pressable disabled={saving} onPress={() => onSave(value)} style={styles.saveWrap}>
                <LinearGradient colors={gradients.fire} style={styles.save}><Check color={colors.text} size={18} /><Text style={styles.saveText}>{saving ? "Saving your vibe..." : "Apply preferences"}</Text></LinearGradient>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const defaults: MatchPreferences = { interestedIn: "Everyone", lookingFor: "Friendship", datingAgeMin: 18, datingAgeMax: 35, verifiedOnly: false };
function PreferenceGroup({ title, children }: { title: string; children: React.ReactNode }) { return <View style={styles.group}><Text style={styles.groupTitle}>{title}</Text>{children}</View>; }
function ChoiceRow({ options, selected, onSelect }: { options: string[]; selected: string; onSelect: (value: string) => void }) { return <View style={styles.choices}>{options.map((option) => <Pressable key={option} onPress={() => onSelect(option)} style={[styles.choice, selected === option && styles.choiceActive]}><Text style={[styles.choiceText, selected === option && styles.choiceTextActive]}>{option}</Text></Pressable>)}</View>; }
function AgeControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <View style={styles.ageControl}><Text style={styles.ageLabel}>{label}</Text><View style={styles.stepper}><Pressable accessibilityLabel={`Decrease ${label} age`} onPress={() => onChange(Math.max(18, value - 1))} style={styles.step}><Minus color={colors.text} size={16} /></Pressable><Text style={styles.ageValue}>{value}</Text><Pressable accessibilityLabel={`Increase ${label} age`} onPress={() => onChange(Math.min(80, value + 1))} style={styles.step}><Plus color={colors.text} size={16} /></Pressable></View></View>; }

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(5,7,19,0.7)", justifyContent: "flex-end" },
  sheet: { maxHeight: "88%", backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, borderColor: colors.line, paddingTop: 10 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: "center", marginBottom: 8 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: colors.line },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }, icon: { width: 40, height: 40, borderRadius: 13, backgroundColor: "rgba(255,62,147,0.12)", alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 }, close: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  body: { padding: 20, paddingBottom: 36, gap: 24 }, group: { gap: 11 }, groupTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, choice: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: radii.pill, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }, choiceActive: { backgroundColor: colors.pink, borderColor: colors.pink }, choiceText: { color: colors.muted, fontSize: 12, fontWeight: "800" }, choiceTextActive: { color: colors.text },
  ageRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 }, ageDash: { width: 14, height: 2, backgroundColor: colors.line, marginBottom: 21 }, ageControl: { flex: 1, gap: 7 }, ageLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" }, stepper: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: radii.md }, step: { width: 38, height: 42, alignItems: "center", justifyContent: "center" }, ageValue: { color: colors.text, fontSize: 16, fontWeight: "900" },
  verifyRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 15, borderRadius: radii.md, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line }, verifyTitle: { color: colors.text, fontSize: 14, fontWeight: "900" }, verifyCopy: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  saveWrap: { height: 54, borderRadius: radii.md, overflow: "hidden" }, save: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, saveText: { color: colors.text, fontSize: 15, fontWeight: "900" }
});
