import { PhotoPreviewModal } from "@/src/components/molecules/PhotoPreviewModal";
import { usePhotoSession } from "@/src/hooks/usePhotoSession";
import type { SubmissionPhoto } from "@/src/types";
import { Image } from "expo-image";
import { Camera, Check, ImagePlus } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useUnistyles } from "react-native-unistyles";
import { styles } from "./index.styles";

export default function PhotosScreen() {
  const { theme } = useUnistyles();
  const {
    sessionPhotos,
    checked,
    checkedCount,
    capturePhoto,
    pickFromLibrary,
    handleDone,
    toggleChecked,
  } = usePhotoSession();
  const [previewPhoto, setPreviewPhoto] = useState<SubmissionPhoto | null>(
    null,
  );

  return (
    <>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Photos</Text>
          <View style={styles.sourceRow}>
            {[
              {
                label: "Camera",
                icon: <Camera size={18} color={theme.colors.text} />,
                onPress: capturePhoto,
              },
              {
                label: "Library",
                icon: <ImagePlus size={18} color={theme.colors.text} />,
                onPress: pickFromLibrary,
              },
            ].map(({ label, icon, onPress }) => (
              <Pressable
                key={label}
                onPress={onPress}
                style={styles.sourceBtn}
                accessibilityRole="button"
              >
                {icon}
                <Text style={styles.sourceBtnText}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.status}>
            {checkedCount > 0
              ? `${checkedCount} of ${sessionPhotos.length} included`
              : sessionPhotos.length > 0
                ? "Tap a photo to preview and include"
                : "No photos yet — use Camera or Library above"}
          </Text>
          {sessionPhotos.length > 0 && (
            <View style={styles.grid}>
              {sessionPhotos.map((photo) => {
                const isChecked = checked[photo.local_id] ?? false;
                return (
                  <Pressable
                    key={photo.local_id}
                    onPress={() => setPreviewPhoto(photo)}
                    accessibilityRole="button"
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      cachePolicy="memory-disk"
                      style={[styles.thumb, { opacity: isChecked ? 1 : 0.35 }]}
                      contentFit="cover"
                    />
                    <View
                      style={[
                        styles.checkCircle,
                        {
                          backgroundColor: isChecked
                            ? theme.colors.accent
                            : theme.colors.surface,
                          borderColor: isChecked
                            ? theme.colors.accent
                            : theme.colors.muted,
                        },
                      ]}
                    >
                      {isChecked && (
                        <Check size={14} color={theme.colors.accentText} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          onPress={handleDone}
          style={styles.doneBtn}
          accessibilityRole="button"
        >
          <Text style={styles.doneBtnText}>
            {checkedCount > 0 ? `Done (${checkedCount})` : "Done"}
          </Text>
        </Pressable>
      </View>

      {previewPhoto && (
        <PhotoPreviewModal
          photo={previewPhoto}
          isChecked={checked[previewPhoto.local_id] ?? false}
          onClose={() => setPreviewPhoto(null)}
          onToggle={() => toggleChecked(previewPhoto.local_id)}
        />
      )}
    </>
  );
}
