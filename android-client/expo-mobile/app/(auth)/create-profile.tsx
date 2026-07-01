import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, Sparkles } from "lucide-react-native";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

const AVAILABLE_INTERESTS = [
  "Music", "Gaming", "Movies", "Fitness", "Travel", "Late night talks",
  "Friendship", "Dating", "Serious relationship", "Voice rooms", "Video rooms",
  "Anime", "Tech", "Spirituality", "Food", "Study", "Career"
];

const AVAILABLE_LANGUAGES = ["Hindi", "English", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Punjabi", "Urdu"];

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330", // Female 1
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e", // Male 1
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce", // Female 2
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12", // Male 2
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1", // Female 3
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"  // Male 3
];

export default function CreateProfile() {
  const current = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState(current?.name ?? "");
  const [username, setUsername] = useState(current?.username ?? "");
  const [age, setAge] = useState(current?.age ? String(current.age) : "");
  const [gender, setGender] = useState(current?.gender ?? "");
  const [city, setCity] = useState(current?.city ?? "");
  const [state, setState] = useState(current?.state ?? "");
  const [bio, setBio] = useState(current?.bio ?? "");
  const [vibeLine, setVibeLine] = useState(current?.vibeLine ?? "");
  const [avatar, setAvatar] = useState(current?.avatar ?? PRESET_AVATARS[0]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>(current?.interests ?? []);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(current?.languages ?? ["Hindi", "English"]);

  // Dating preferences
  const [interestedIn, setInterestedIn] = useState(current?.interestedIn ?? "EVERYONE");
  const [lookingFor, setLookingFor] = useState(current?.lookingFor ?? "dating");
  const [datingAgeMin, setDatingAgeMin] = useState("18");
  const [datingAgeMax, setDatingAgeMax] = useState("35");

  function validateStep() {
    setError("");
    if (step === 1) {
      if (!name.trim()) return "Name is required.";
      if (!username.trim() || username.length < 3) return "Username must be at least 3 chars.";
      if (!/^[a-z0-9_.]+$/i.test(username)) return "Username can only have letters, numbers, dot, underscore.";
      const ageNum = Number(age);
      if (isNaN(ageNum) || ageNum < 18 || ageNum > 90) return "You must be 18+ to enter Yugm.";
      if (!gender) return "Please select your gender.";
    }
    if (step === 2) {
      if (!city.trim()) return "City is required.";
      if (selectedLanguages.length === 0) return "Please choose at least one language.";
    }
    if (step === 3) {
      if (selectedInterests.length < 2) return "Please choose at least 2 interests.";
    }
    if (step === 4) {
      if (!bio.trim() || bio.length < 10) return "Bio must be at least 10 characters.";
      if (!vibeLine.trim()) return "Vibe line is required.";
    }
    return "";
  }

  function handleNext() {
    const validationError = validateStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (step < 5) {
      setStep(step + 1);
    } else {
      save();
    }
  }

  function handleBack() {
    if (step > 1) {
      setError("");
      setStep(step - 1);
    }
  }

  async function save() {
    setLoading(true);
    setError("");
    try {
      const payload = {
        name,
        username,
        age: Number(age),
        gender,
        city,
        state,
        bio,
        vibeLine,
        avatar,
        interests: selectedInterests,
        languages: selectedLanguages,
        interestedIn,
        lookingFor,
        datingAgeMin: Number(datingAgeMin),
        datingAgeMax: Number(datingAgeMax)
      };

      const { user } = await authApi.updateProfile(payload);
      updateUser(user);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header navigation bar */}
        <View style={styles.header}>
          {step > 1 ? (
            <Pressable onPress={handleBack} style={styles.backBtn}>
              <ArrowLeft color={colors.text} size={20} />
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.progressText}>Step {step} of 5</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress line */}
        <View style={styles.progressBarBg}>
          <LinearGradient
            colors={[colors.pink, colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.progressBarFill, { width: `${(step / 5) * 100}%` }]}
          />
        </View>

        <ScrollView contentContainerStyle={styles.scrollWrap} keyboardShouldPersistTaps="handled">
          
          {step === 1 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Tell us about yourself</Text>
              <Text style={styles.stepSubtitle}>Let's start with the basics to set up your identity card.</Text>

              <Text style={styles.label}>What is your name?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Full Name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>Choose a unique username</Text>
              <TextInput
                value={username}
                onChangeText={setUsername}
                placeholder="username"
                placeholderTextColor={colors.muted}
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.label}>What is your age?</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                placeholder="Must be 18+"
                placeholderTextColor={colors.muted}
                style={styles.input}
                keyboardType="number-pad"
                maxLength={2}
              />

              <Text style={styles.label}>What is your gender?</Text>
              <View style={styles.row}>
                {["MALE", "FEMALE", "NON-BINARY"].map((g) => {
                  const active = gender === g;
                  return (
                    <Pressable
                      key={g}
                      style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{g}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Vibe parameters</Text>
              <Text style={styles.stepSubtitle}>Indian Gen Z connects near and far. Pin your location and tongue.</Text>

              <Text style={styles.label}>Where do you live?</Text>
              <TextInput
                value={city}
                onChangeText={setCity}
                placeholder="City (e.g. Mumbai, Delhi, Pune)"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <TextInput
                value={state}
                onChangeText={setState}
                placeholder="State (e.g. Maharashtra, Karnataka)"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>Preferred Languages</Text>
              <View style={styles.chipsWrap}>
                {AVAILABLE_LANGUAGES.map((lang) => {
                  const selected = selectedLanguages.includes(lang);
                  return (
                    <Pressable
                      key={lang}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() =>
                        setSelectedLanguages((prev) =>
                          selected ? prev.filter((l) => l !== lang) : [...prev, lang]
                        )
                      }
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{lang}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Pick your interests</Text>
              <Text style={styles.stepSubtitle}>We use these to calculate vibe match compatibility percentages.</Text>

              <View style={styles.chipsWrap}>
                {AVAILABLE_INTERESTS.map((interest) => {
                  const selected = selectedInterests.includes(interest);
                  return (
                    <Pressable
                      key={interest}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() =>
                        setSelectedInterests((prev) =>
                          selected ? prev.filter((i) => i !== interest) : [...prev, interest]
                        )
                      }
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{interest}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 4 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Add the visual flare</Text>
              <Text style={styles.stepSubtitle}>Choose a vibe avatar and write a custom Hinglish vibe tagline.</Text>

              <Text style={styles.label}>Select an avatar</Text>
              <View style={styles.avatarRow}>
                {PRESET_AVATARS.map((uri) => {
                  const selected = avatar === uri;
                  return (
                    <Pressable
                      key={uri}
                      onPress={() => setAvatar(uri)}
                      style={[styles.avatarPress, selected && styles.avatarSelected]}
                    >
                      <Image source={{ uri }} style={styles.avatarImg} />
                      {selected && (
                        <View style={styles.checkmarkIcon}>
                          <Check color={colors.ink} size={12} strokeWidth={4} />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Write your Hinglish Vibe Line</Text>
              <TextInput
                value={vibeLine}
                onChangeText={setVibeLine}
                placeholder="e.g. Chai over Coffee, Valorant on weekends 🎮"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />

              <Text style={styles.label}>Write a short bio</Text>
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="Tell others who you are. What makes you tick?"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                multiline
                numberOfLines={4}
              />
            </View>
          )}

          {step === 5 && (
            <View style={styles.card}>
              <Text style={styles.stepTitle}>Dating Preferences</Text>
              <Text style={styles.stepSubtitle}>Tell us what vibe matches you are looking for.</Text>

              <Text style={styles.label}>Who are you interested in?</Text>
              <View style={styles.row}>
                {["MALE", "FEMALE", "EVERYONE"].map((opt) => {
                  const active = interestedIn === opt;
                  return (
                    <Pressable
                      key={opt}
                      style={[styles.choiceBtn, active && styles.choiceBtnActive]}
                      onPress={() => setInterestedIn(opt)}
                    >
                      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{opt}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Looking for...</Text>
              <View style={styles.chipsWrap}>
                {[
                  { value: "friends", label: "Friendship" },
                  { value: "dating", label: "Dating" },
                  { value: "serious", label: "Serious Relationship" },
                  { value: "casual", label: "Casual Social" },
                  { value: "community", label: "Live Community" }
                ].map((item) => {
                  const active = lookingFor === item.value;
                  return (
                    <Pressable
                      key={item.value}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setLookingFor(item.value)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>Preferred Age Range</Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sublabel}>Min Age</Text>
                  <TextInput
                    value={datingAgeMin}
                    onChangeText={setDatingAgeMin}
                    placeholder="18"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={{ width: 16 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.sublabel}>Max Age</Text>
                  <TextInput
                    value={datingAgeMax}
                    onChangeText={setDatingAgeMax}
                    placeholder="35"
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
              </View>
            </View>
          )}

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          {/* Action button */}
          <Pressable onPress={handleNext} disabled={loading} style={styles.ctaPress}>
            <LinearGradient colors={gradients.fire} style={styles.cta}>
              <Text style={styles.ctaText}>
                {step === 5 ? (loading ? "Entering Yugm..." : "Enter Yugm") : "Continue"}
              </Text>
            </LinearGradient>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 52
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  progressText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  progressBarBg: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    width: "100%"
  },
  progressBarFill: {
    height: 3
  },
  scrollWrap: {
    padding: 24,
    paddingBottom: 48
  },
  card: {
    gap: 12
  },
  stepTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  stepSubtitle: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16
  },
  label: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
    marginTop: 8,
    marginBottom: 4
  },
  sublabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4
  },
  input: {
    height: 52,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 15
  },
  textArea: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: "top"
  },
  row: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 4
  },
  choiceBtn: {
    flex: 1,
    height: 50,
    borderRadius: 10,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  choiceBtnActive: {
    borderColor: colors.pink,
    backgroundColor: "rgba(255,62,147,0.12)"
  },
  choiceText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 14
  },
  choiceTextActive: {
    color: colors.pink,
    fontWeight: "800"
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  chipActive: {
    backgroundColor: colors.pink,
    borderColor: colors.pink
  },
  chipText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13
  },
  chipTextActive: {
    color: colors.text,
    fontWeight: "800"
  },
  avatarRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
    marginVertical: 10
  },
  avatarPress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "transparent",
    position: "relative"
  },
  avatarSelected: {
    borderColor: colors.pink
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    borderRadius: 40
  },
  checkmarkIcon: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: colors.pink,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.ink
  },
  errorText: {
    color: colors.danger,
    fontWeight: "700",
    marginTop: 18,
    textAlign: "center"
  },
  ctaPress: {
    marginTop: 28
  },
  cta: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  ctaText: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 16
  }
});
