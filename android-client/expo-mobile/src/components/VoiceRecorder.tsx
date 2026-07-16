import { useState, useRef, useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Mic, Square, Upload } from "lucide-react-native";
import { uploadVoiceNote } from "@/lib/api";
import { colors } from "@/theme/colors";

interface VoiceRecorderProps {
  onComplete: (url: string, duration: number) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ onComplete, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "uploading">("idle");
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setState("idle");
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      if (!uri) return;
      setState("uploading");
      const file = { uri, name: `voice-${Date.now()}.m4a`, type: "audio/m4a" };
      const result = await uploadVoiceNote(file);
      onComplete(result.url, duration);
    } catch {
      setState("idle");
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      {state === "idle" && (
        <Pressable onPress={startRecording} style={styles.micBtn}>
          <Mic color={colors.text} size={22} />
        </Pressable>
      )}
      {state === "recording" && (
        <View style={styles.recordingRow}>
          <View style={styles.recordingDot} />
          <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          <Pressable onPress={stopRecording} style={styles.stopBtn}>
            <Square color={colors.text} size={16} />
          </Pressable>
        </View>
      )}
      {state === "uploading" && (
        <View style={styles.uploadingRow}>
          <Upload color={colors.gold} size={18} />
          <Text style={styles.uploadingText}>Uploading...</Text>
        </View>
      )}
      {state === "idle" && (
        <Pressable onPress={onCancel} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,94,107,0.15)",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.danger,
  },
  durationText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
    minWidth: 50,
  },
  stopBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  uploadingText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "800",
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800",
  },
});
