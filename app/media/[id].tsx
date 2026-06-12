import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Linking, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useGlasses } from '@/hooks/useGlasses';
import { Button } from '@/components';
import { theme } from '@/constants/theme';
import { MediaItem } from '@/types';
import { useAlert } from '@/template';

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { media, isOnline, analyzeMedia, deleteMedia } = useGlasses();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const foundItem = media.find(m => m.id === id);
    if (foundItem) {
      setItem(foundItem);
    }
  }, [id, media]);

  const handleAnalyze = async () => {
    if (!item) return;

    if (!isOnline) {
      showAlert('Offline', 'AI analysis requires internet connection');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeMedia(item);
      setItem(prev => prev ? {
        ...prev,
        aiCaption: result.caption,
        aiTags: result.tags
      } : null);
      showAlert('Analysis Complete', 'AI caption and tags generated successfully');
    } catch (error) {
      console.error('Failed to analyze:', error);
      showAlert('Analysis Failed', 'Could not analyze media. Please try again.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async () => {
    if (!item) return;

    Alert.alert(
      'Delete Media',
      'Are you sure you want to permanently delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMedia(item);
              router.back();
              showAlert('Deleted', 'Media removed successfully');
            } catch (error) {
              showAlert('Error', 'Failed to delete media');
            } finally {
              setDeleting(false);
            }
          }
        },
      ]
    );
  };

  const handleDownload = async () => {
    if (!item) return;
    try {
      await Linking.openURL(item.uri);
    } catch (error) {
      showAlert('Error', 'Could not open download link');
    }
  };

  if (!item) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>Media not found</Text>
          <Button title="Go Back" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  const formattedDate = new Date(item.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="contain"
          transition={300}
        />

        <View style={styles.infoSection}>
          <View style={styles.typeRow}>
            <MaterialIcons
              name={item.type === 'photo' ? 'photo' : 'videocam'}
              size={24}
              color={theme.colors.primary}
            />
            <Text style={styles.typeText}>
              {item.type === 'photo' ? 'Photo' : 'Video'}
              {item.duration && ` · ${item.duration}s`}
            </Text>
            {item.localOnly && (
              <View style={styles.localBadge}>
                <MaterialIcons name="cloud-off" size={14} color={theme.colors.textSecondary} />
                <Text style={styles.localText}>Local Only</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <MaterialIcons name="access-time" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{formattedDate}</Text>
          </View>

          {item.location && (
            <View style={styles.metaRow}>
              <MaterialIcons name="location-on" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.metaText}>{item.location}</Text>
            </View>
          )}

          {item.aiCaption ? (
            <View style={styles.captionBox}>
              <View style={styles.captionHeader}>
                <MaterialIcons name="auto-awesome" size={20} color={theme.colors.ai} />
                <Text style={styles.captionLabel}>AI Description</Text>
              </View>
              <Text style={styles.captionText}>{item.aiCaption}</Text>

              {item.aiTags && item.aiTags.length > 0 && (
                <View style={styles.tagsContainer}>
                  {item.aiTags.map((tag, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Button
              title={analyzing ? 'Analyzing...' : 'Generate AI Analysis'}
              onPress={handleAnalyze}
              loading={analyzing}
              variant="outline"
              fullWidth
            />
          )}

          <View style={styles.actions}>
            <Pressable
              style={styles.actionButton}
              onPress={handleDownload}
            >
              <MaterialIcons name="download" size={24} color={theme.colors.text} />
              <Text style={styles.actionText}>Download</Text>
            </Pressable>

            <Pressable
              style={styles.actionButton}
              onPress={handleDelete}
              disabled={deleting}
            >
              <MaterialIcons
                name="delete"
                size={24}
                color={deleting ? theme.colors.textSecondary : theme.colors.error}
              />
              <Text style={[styles.actionText, { color: deleting ? theme.colors.textSecondary : theme.colors.error }]}>
                {deleting ? 'Deleting...' : 'Delete'}
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  image: {
    width: '100%',
    height: 400,
    backgroundColor: theme.colors.surface,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 18,
    color: theme.colors.textSecondary,
  },
  infoSection: {
    padding: 20,
    gap: 16,
  },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
    flex: 1,
  },
  localBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
  },
  localText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  captionBox: {
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    gap: 12,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  captionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.ai,
  },
  captionText: {
    fontSize: 15,
    color: theme.colors.text,
    lineHeight: 22,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
  },
  actionButton: {
    alignItems: 'center',
    gap: 6,
    padding: 12,
  },
  actionText: {
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: '500',
  },
});
