import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Check, ArrowLeft } from "lucide-react-native";
import { Screen, Section } from "@/components/Screen";
import { LANGUAGES } from "@/i18n";
import { useLanguage } from "@/i18n/hooks";
import { colors } from "@/theme/colors";

export default function LanguageSettings() {
  const { language, changeLanguage } = useLanguage();

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Language</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollWrap}>
        <Section>
          {LANGUAGES.map((lang) => {
            const active = language === lang.code;
            return (
              <Pressable
                key={lang.code}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => changeLanguage(lang.code)}
              >
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowName, active && styles.rowTextActive]}>{lang.nativeName}</Text>
                  <Text style={[styles.rowEnglish, active && styles.rowTextActive]}>{lang.name}</Text>
                </View>
                {active && <Check color={colors.gold} size={20} />}
              </Pressable>
            );
          })}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  scrollWrap: { paddingTop: 16, paddingBottom: 48 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 60, borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 4 },
  rowActive: { backgroundColor: "rgba(246,180,75,0.06)" },
  rowInfo: { flex: 1 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  rowEnglish: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 2 },
  rowTextActive: { color: colors.gold },
});
