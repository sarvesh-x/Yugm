import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View, Image, StatusBar, Dimensions } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { X, Heart, MessageSquare } from "lucide-react-native";
import { StoryComments } from "@/components/StoryComments";
import { colors } from "@/theme/colors";
import { absoluteMediaUrl, storiesApi } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Story {
  _id: string;
  userId: { _id: string; name: string; avatar?: string };
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO";
  caption?: string;
  viewCount: number;
  likeCount: number;
  replyCount: number;
  isViewed?: boolean;
  isLiked?: boolean;
}

interface Props {
  stories: Story[];
  onClose: () => void;
  startIndex?: number;
}

export function StoryViewer({ stories, onClose, startIndex = 0 }: Props) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const videoRef = useRef<Video>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = stories[currentIndex];

  useEffect(() => {
    if (current && !current.isViewed) {
      storiesApi.view(current._id).catch(() => {});
    }
  }, [currentIndex]);

  useEffect(() => {
    setProgress(0);
    if (current?.mediaType === "VIDEO") return;
    if (paused) return;

    const interval = 50;
    const totalSteps = 5000 / interval;
    let step = 0;
    progressTimer.current = setInterval(() => {
      step++;
      setProgress(Math.min(step / totalSteps, 1));
      if (step >= totalSteps) {
        if (progressTimer.current) clearInterval(progressTimer.current);
        goNext();
      }
    }, interval);

    return () => {
      if (progressTimer.current) clearInterval(progressTimer.current);
    };
  }, [currentIndex, paused]);

  const goNext = useCallback(() => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      onClose();
    }
  }, [currentIndex, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleTap = useCallback(
    (evt: { nativeEvent: { locationX: number } }) => {
      const x = evt.nativeEvent.locationX;
      const third = SCREEN_WIDTH / 3;
      if (x < third) {
        goPrev();
      } else if (x > third * 2) {
        goNext();
      } else {
        setPaused((p) => !p);
      }
    },
    [goNext, goPrev]
  );

  const handleLike = useCallback(async () => {
    try {
      await storiesApi.like(current._id);
    } catch {}
  }, [current]);

  const handleVideoStatus = useCallback(
    (status: any) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        goNext();
      }
      setProgress(status.positionMillis / (status.durationMillis || 1));
    },
    [goNext]
  );

  if (!current) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={styles.container}>
        <View style={styles.progressRow}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressBg}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: i < currentIndex ? "100%" : i === currentIndex ? `${progress * 100}%` : "0%",
                    backgroundColor: i <= currentIndex ? colors.text : colors.muted,
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.topBar}>
          <View style={styles.userInfo}>
            <Image
              source={{ uri: absoluteMediaUrl(current.userId.avatar ?? "") }}
              style={styles.userAvatar}
            />
            <Text style={styles.userName}>{current.userId.name}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <X color={colors.text} size={24} />
          </Pressable>
        </View>

        {current.caption ? (
          <Text style={styles.caption}>{current.caption}</Text>
        ) : null}

        <Pressable style={styles.mediaArea} onPress={handleTap}>
          {current.mediaType === "VIDEO" ? (
            <Video
              ref={videoRef}
              source={{ uri: absoluteMediaUrl(current.mediaUrl) }}
              style={styles.media}
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay={!paused}
              isLooping={false}
              onPlaybackStatusUpdate={handleVideoStatus}
            />
          ) : (
            <Image
              source={{ uri: absoluteMediaUrl(current.mediaUrl) }}
              style={styles.media}
              resizeMode="contain"
            />
          )}
        </Pressable>

        <View style={styles.bottomBar}>
          <Pressable onPress={handleLike} style={styles.likeBtn}>
            <Heart
              color={current.isLiked ? colors.pink : colors.text}
              size={24}
              fill={current.isLiked ? colors.pink : "transparent"}
            />
            <Text style={styles.countText}>{current.likeCount}</Text>
          </Pressable>
          <Pressable onPress={() => setCommentsVisible(true)} style={styles.likeBtn}>
            <MessageSquare color={colors.text} size={22} />
            <Text style={styles.countText}>{current.replyCount ?? 0}</Text>
          </Pressable>
          <Text style={styles.countText}>{current.viewCount} views</Text>
        </View>

        <StoryComments
          storyId={current._id}
          storyUserId={current.userId._id}
          visible={commentsVisible}
          onClose={() => setCommentsVisible(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  progressRow: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 56,
    paddingBottom: 8,
  },
  progressBg: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.text,
  },
  userName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "900",
  },
  caption: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingBottom: 12,
    textAlign: "center",
  },
  mediaArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  media: {
    width: SCREEN_WIDTH,
    height: "100%",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  countText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
  },
});
