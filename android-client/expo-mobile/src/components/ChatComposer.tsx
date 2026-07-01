import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Send } from "lucide-react-native";
import { colors } from "@/theme/colors";

export function ChatComposer({ onSend }: { onSend: (message: string) => void }) {
  const [message, setMessage] = useState("");
  return (
    <View style={styles.row}>
      <TextInput
        value={message}
        onChangeText={setMessage}
        placeholder="Say something live..."
        placeholderTextColor={colors.muted}
        style={styles.input}
        keyboardType="default"
      />
      <Pressable
        style={styles.send}
        onPress={() => {
          if (message.trim()) onSend(message.trim());
          setMessage("");
        }}
      >
        <Send color={colors.text} size={18} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, padding: 12, borderTopWidth: 1, borderColor: colors.line },
  input: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.panel, color: colors.text, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.line },
  send: { width: 44, height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.purple }
});
