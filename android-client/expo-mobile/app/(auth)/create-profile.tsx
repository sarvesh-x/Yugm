import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, Sparkles } from "lucide-react-native";
import { authApi, datingApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

const AVAILABLE_INTERESTS = [
  "Music", "Gaming", "Movies", "Fitness", "Travel", "Late night talks",
  "Friendship", "Dating", "Serious relationship", "Voice rooms", "Video rooms",
  "Anime", "Tech", "Spirituality", "Food", "Study", "Career"
];

const AVAILABLE_LANGUAGES = ["Hindi", "English", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Punjabi", "Urdu"];
const AVAILABLE_HOBBIES = ["Singing", "Dancing", "Podcasting", "Photography", "Cooking", "Reading", "Writing", "Cricket", "Football", "Badminton", "Drawing", "Streaming", "Gym", "Coding", "Memes", "Volunteering"];

const PRESET_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330", // Female 1
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e", // Male 1
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce", // Female 2
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12", // Male 2
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1", // Female 3
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d"  // Male 3
];

type InterestedIn = "Everyone" | "Women" | "Men" | "Non-binary";
type LookingFor = "Friendship" | "Dating" | "Relationship" | "Networking";

function normalizeInterestedIn(value?: string): InterestedIn {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "women" || normalized === "female") return "Women";
  if (normalized === "men" || normalized === "male") return "Men";
  if (normalized === "non-binary" || normalized === "nonbinary") return "Non-binary";
  return "Everyone";
}

function normalizeLookingFor(value?: string): LookingFor {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "dating" || normalized === "casual") return "Dating";
  if (normalized === "relationship" || normalized === "serious" || normalized === "serious relationship") return "Relationship";
  if (normalized === "networking" || normalized === "community" || normalized === "live community") return "Networking";
  return "Friendship";
}

function normalizeGender(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "male") return "Male";
  if (normalized === "female") return "Female";
  if (normalized === "non-binary" || normalized === "nonbinary") return "Non-binary";
  return value ?? "";
}

export default function CreateProfile() {
  const current = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(Boolean(current?._id ?? current?.id));

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
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>(current?.hobbies ?? []);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(current?.languages ?? ["Hindi", "English"]);

  // Dating preferences
  const [interestedIn, setInterestedIn] = useState<InterestedIn>(normalizeInterestedIn(current?.interestedIn));
  const [lookingFor, setLookingFor] = useState<LookingFor>(normalizeLookingFor(current?.lookingFor));
  const [datingAgeMin, setDatingAgeMin] = useState(String(current?.datingAgeMin ?? 18));
  const [datingAgeMax, setDatingAgeMax] = useState(String(current?.datingAgeMax ?? 35));

  useEffect(() => {
    const userId = current?._id ?? current?.id;
    if (!userId) {
      setInitializing(false);
      return;
    }
    const profileUserId = userId;
    let cancelled = false;
    async function loadCurrentProfile() {
      setInitializing(true);
      const [profileResult, preferencesResult] = await Promise.allSettled([
        usersApi.get(profileUserId),
        datingApi.preferences()
      ]);
      if (cancelled) return;
      if (profileResult.status === "fulfilled") {
        const profile = profileResult.value.user;
        setName(profile.name ?? "");
        setUsername(profile.username ?? "");
        setAge(profile.age ? String(profile.age) : "");
        setGender(normalizeGender(profile.gender));
        setCity(profile.city ?? "");
        setState(profile.state ?? "");
        setBio(profile.bio ?? "");
        setVibeLine(profile.vibeLine ?? "");
        setAvatar(profile.avatar ?? PRESET_AVATARS[0]);
        setSelectedInterests(profile.interests ?? []);
        setSelectedHobbies(profile.hobbies ?? []);
        setSelectedLanguages(profile.languages?.length ? profile.languages : ["Hindi", "English"]);
        if (current) updateUser({ ...current, ...profile });
      }
      if (preferencesResult.status === "fulfilled") {
        const preferences = preferencesResult.value.preferences;
        setInterestedIn(normalizeInterestedIn(preferences.interestedIn));
        setLookingFor(normalizeLookingFor(preferences.lookingFor));
        setDatingAgeMin(String(preferences.datingAgeMin ?? 18));
        setDatingAgeMax(String(preferences.datingAgeMax ?? 35));
      }
      setInitializing(false);
    }
    loadCurrentProfile().catch(() => {
      if (!cancelled) setInitializing(false);
    });
    return () => { cancelled = true; };
  }, [current?._id, current?.id, updateUser]);

  function validateStep() {
    setError("");
    if (step === 1) {
      if (!name.trim()) return "Name is required.";
      if (!username.trim() || username.length < 3) return "Username must be at least 3 chars.";
      if (!/^[a-z0-9_.]+$/i.test(username)) return "Username can only have letters, numbers, dot, underscore.";
      const ageNum = Number(age);
      if (!Number.isInteger(ageNum) || ageNum < 18 || ageNum > 80) return "Age must be between 18 and 80.";
      if (!gender) return "Please select your gender.";
    }
    if (step === 2) {
      if (!city.trim()) return "City is required.";
      if (selectedLanguages.length === 0) return "Please choose at least one language.";
    }
    if (step === 3) {
      if (selectedInterests.length < 2) return "Please choose at least 2 interests.";
      if (selectedHobbies.length < 1) return "Please choose at least 1 hobby.";
    }
    if (step === 4) {
      if (!bio.trim() || bio.length < 10) return "Bio must be at least 10 characters.";
      if (!vibeLine.trim()) return "Vibe line is required.";
    }
    if (step === 5) {
      const minAge = Number(datingAgeMin);
      const maxAge = Number(datingAgeMax);
      if (!Number.isInteger(minAge) || !Number.isInteger(maxAge) || minAge < 18 || maxAge > 80) return "Choose an age range between 18 and 80.";
      if (minAge > maxAge) return "Minimum age cannot be greater than maximum age.";
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
        hobbies: selectedHobbies,
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
      {initializing ? (
        <View style={styles.initializing}>
          <ActivityIndicator color={colors.pink} size="large" />
          <Text style={styles.initializingText}>Loading your profile...</Text>
        </View>
      ) : (
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
                {["Male", "Female", "Non-binary"].map((g) => {
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
              <Text style={styles.stepTitle}>Pick your interests and hobbies</Text>
              <Text style={styles.stepSubtitle}>We use these to calculate vibe match compatibility percentages and fill your detailed profile.</Text>

              <Text style={styles.label}>Interests</Text>
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

              <Text style={styles.label}>Hobbies</Text>
              <View style={styles.chipsWrap}>
                {AVAILABLE_HOBBIES.map((hobby) => {
                  const selected = selectedHobbies.includes(hobby);
                  return (
                    <Pressable
                      key={hobby}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() =>
                        setSelectedHobbies((prev) =>
                          selected ? prev.filter((item) => item !== hobby) : [...prev, hobby]
                        )
                      }
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{hobby}</Text>
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
                {(["Women", "Men", "Non-binary", "Everyone"] as InterestedIn[]).map((opt) => {
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
                  { value: "Friendship" as const, label: "Friendship" },
                  { value: "Dating" as const, label: "Dating" },
                  { value: "Relationship" as const, label: "Relationship" },
                  { value: "Networking" as const, label: "Networking" }
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  initializing: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  initializingText: { color: colors.muted, fontWeight: "700" },
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
