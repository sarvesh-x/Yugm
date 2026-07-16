import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "@/theme/colors";
import { absoluteMediaUrl } from "@/lib/api";
import { StoryViewer } from "./StoryViewer";
import { Plus } from "lucide-react-native";

export interface StoryUser {
  _id: string;
  name: string;
  avatar?: string;
}

export interface Story {
  _id: string;
  userId: StoryUser;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  caption?: string;
  viewCount: number;
  likeCount: number;
  isViewed?: boolean;
  isLiked?: boolean;
}

export interface StoryGroup {
  user: StoryUser;
  stories: Story[];
}

interface Props {
  groups: StoryGroup[];
  onAddPress?: () => void;
}

export function StoriesRing({ groups, onAddPress }: Props) {
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);
  const handleClose = useCallback(() => setViewingIndex(null), []);
  const viewingGroup = viewingIndex !== null ? groups[viewingIndex] : null;

  return (
    <>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={groups}
        keyExtractor={(item) => item.user._id}
        contentContainerStyle={styles.container}
        ListHeaderComponent={
          onAddPress ? (
            <Pressable onPress={onAddPress} style={styles.addButton}>
              <View style={styles.addCircle}>
                <Plus color={colors.text} size={22} />
              </View>
              <Text style={styles.addLabel}>Your Story</Text>
            </Pressable>
          ) : null
        }
        renderItem={({ item, index }) => {
          const allViewed = item.stories.every((s) => s.isViewed);
          return (
            <Pressable onPress={() => setViewingIndex(index)} style={styles.ringWrap}>
              <LinearGradient
                colors={allViewed ? [colors.line, colors.line] : [colors.pink, colors.purple]}
                style={styles.ringBorder}
              >
                <View style={styles.ringInner}>
                  <Image
                    source={{ uri: absoluteMediaUrl(item.user.avatar ?? "") }}
                    style={styles.avatar}
                  />
                </View>
              </LinearGradient>
              <Text style={styles.name} numberOfLines={1}>
                {item.user.name.split(" ")[0]}
              </Text>
            </Pressable>
          );
        }}
      />
      {viewingGroup && (
        <StoryViewer
          stories={viewingGroup.stories}
          onClose={handleClose}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 4, paddingVertical: 8, gap: 0 },
  addButton: { alignItems: "center", marginRight: 12, width: 68 },
  addCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.pink,
  },
  addLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 4 },
  ringWrap: { alignItems: "center", marginRight: 14, width: 68 },
  ringBorder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  ringInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.ink2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  name: { color: colors.text, fontSize: 11, fontWeight: "800", marginTop: 4, maxWidth: 64 },
});
