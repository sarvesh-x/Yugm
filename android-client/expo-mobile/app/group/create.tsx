import { useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Pressable,
  ActivityIndicator
} from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Plus, Check, X } from "lucide-react-native";
import { groupsApi, usersApi } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { colors } from "@/theme/colors";

export default function CreateGroup() {
  const queryClient = useQueryClient();
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<any[]>([]);

  const { data: searchData, isLoading: searching } = useQuery({
    queryKey: ["users", "search", searchQuery],
    queryFn: () => usersApi.search(searchQuery),
    enabled: searchQuery.length >= 2
  });

  const searchResults = searchData?.users ?? [];

  const createMutation = useMutation({
    mutationFn: () => groupsApi.create({ name: groupName, participantIds: selectedIds }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      const groupId = data.group._id || data.group.id;
      router.replace({ pathname: "/group/[id]", params: { id: groupId } });
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const toggleUser = (user: any) => {
    const userId = user._id || user.id;
    if (selectedIds.includes(userId)) {
      setSelectedIds(selectedIds.filter((id) => id !== userId));
      setSelectedUsers(selectedUsers.filter((u) => (u._id || u.id) !== userId));
    } else {
      setSelectedIds([...selectedIds, userId]);
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleCreate = () => {
    if (!groupName.trim()) {
      Alert.alert("Error", "Please enter a group name");
      return;
    }
    if (selectedIds.length < 2) {
      Alert.alert("Error", "Add at least 2 participants");
      return;
    }
    createMutation.mutate();
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>New Group</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Group name"
          placeholderTextColor={colors.muted}
          style={styles.nameInput}
          maxLength={60}
        />

        {selectedUsers.length > 0 && (
          <View style={styles.selectedRow}>
            {selectedUsers.map((user) => (
              <Pressable key={user._id || user.id} style={styles.selectedChip} onPress={() => toggleUser(user)}>
                <Text style={styles.selectedChipText}>{user.name}</Text>
                <X color={colors.muted} size={14} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.searchRow}>
          <Search color={colors.muted} size={18} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search users..."
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
          />
        </View>

        {searching && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.pink} size="small" />
          </View>
        )}

        <FlatList
          data={searchResults}
          keyExtractor={(item) => item._id || item.id}
          style={styles.resultsList}
          renderItem={({ item }) => {
            const userId = item._id || item.id;
            const isSelected = selectedIds.includes(userId);
            return (
              <Pressable style={styles.userRow} onPress={() => toggleUser(item)}>
                <Image source={{ uri: item.avatar }} style={styles.userAvatar as any} />
                <Text style={styles.userName}>{item.name}</Text>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Check color={colors.text} size={14} />}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            searchQuery.length >= 2 ? (
              <Text style={styles.emptyText}>No users found</Text>
            ) : null
          }
        />

        <Pressable
          style={[styles.createBtn, (!groupName.trim() || selectedIds.length < 2) && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={!groupName.trim() || selectedIds.length < 2 || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={colors.text} size="small" />
          ) : (
            <Text style={styles.createBtnText}>Create Group</Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  content: { flex: 1, padding: 16 },
  nameInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 12
  },
  selectedRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12
  },
  selectedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.pink,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  selectedChipText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    marginBottom: 12
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    height: 44
  },
  center: { padding: 20, alignItems: "center" },
  resultsList: { flex: 1 },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  userAvatar: { width: 44, height: 44, borderRadius: 22 },
  userName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "800" },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  checkboxSelected: { backgroundColor: colors.pink, borderColor: colors.pink },
  emptyText: { color: colors.muted, textAlign: "center", marginTop: 24, fontWeight: "700" },
  createBtn: {
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16
  },
  createBtnDisabled: { opacity: 0.5, backgroundColor: colors.panel },
  createBtnText: { color: colors.text, fontSize: 16, fontWeight: "900" }
});
