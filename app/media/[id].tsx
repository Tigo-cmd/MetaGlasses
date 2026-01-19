import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Share } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useGlasses } from '@/hooks/useGlasses';
import { useAI } from '@/hooks/useAI';
import { Button } from '@/components';
import { theme } from '@/constants/theme';
import { MediaItem } from '@/types';

export default function MediaDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { media } = useGlasses();
  const { generateCaption } = useAI();
  const [item, setItem] = useState<MediaItem | null>(null);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  useEffect(() => {
    const foundItem = media.find(m => m.id === id);
    if (foundItem) {
      setItem(foundItem);
    }
  }, [id, media]);

  const handleGenerateCaption = async () => {
    if (!item) return;
    
    setGeneratingCaption(true);
    try {
      const caption = await generateCaption(item.uri);
      setItem({ ...item, aiCaption: caption });
    } catch (error) {
      console.error('Failed to generate caption:', error);
    } finally {
      setGeneratingCaption(false);
    }
  };

  const handleShare = async () => {
    if (!item) return;
    
    try {
      await Share.share({
        message: `Check out this ${item.type} from my smart glasses!`,
        url: item.uri,
      });
    } catch (error) {
      console.error('Share failed:', error);
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
            </View>
          ) : (
            <Button
              title="Generate AI Caption"
              onPress={handleGenerateCaption}
              loading={generatingCaption}
              variant="outline"
              fullWidth
            />
          )}

          <View style={styles.actions}>
            <Pressable style={styles.actionButton} onPress={handleShare}>
              <MaterialIcons name="share" size={24} color={theme.colors.text} />
              <Text style={styles.actionText}>Share</Text>
            </Pressable>
            
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="download" size={24} color={theme.colors.text} />
              <Text style={styles.actionText}>Download</Text>
            </Pressable>
            
            <Pressable style={styles.actionButton}>
              <MaterialIcons name="delete" size={24} color={theme.colors.error} />
              <Text style={[styles.actionText, { color: theme.colors.error }]}>Delete</Text>
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
