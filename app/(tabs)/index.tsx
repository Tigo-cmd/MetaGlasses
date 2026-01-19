import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGlasses } from '@/hooks/useGlasses';
import { MediaGrid, StatusBadge, CaptureButton } from '@/components';
import { theme } from '@/constants/theme';
import { useAlert } from '@/template';

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { deviceStatus, media, loading, syncing, capturing, syncMedia, takePhoto } = useGlasses();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const newItems = await syncMedia();
      if (newItems) {
        showAlert('Sync Complete', `${newItems} new items synced from your glasses`);
      }
    } catch (error) {
      showAlert('Sync Failed', 'Could not sync with glasses. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCapture = async () => {
    try {
      const newPhoto = await takePhoto();
      showAlert('Photo Captured', 'Photo saved successfully');
    } catch (error) {
      showAlert('Capture Failed', 'Could not take photo. Please try again.');
    }
  };

  const handleMediaPress = (item: any) => {
    router.push(`/media/${item.id}`);
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading media...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Gallery</Text>
          <Text style={styles.subtitle}>{media.length} items</Text>
        </View>
        {deviceStatus && (
          <StatusBadge connected={deviceStatus.connected} battery={deviceStatus.battery} />
        )}
      </View>

      {media.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          <Image
            source={require('@/assets/images/empty-gallery.png')}
            style={styles.emptyImage}
            contentFit="contain"
          />
          <Text style={styles.emptyTitle}>No Media Yet</Text>
          <Text style={styles.emptyText}>
            Capture your first photo or video using your smart glasses
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
        >
          <MediaGrid media={media} onMediaPress={handleMediaPress} />
        </ScrollView>
      )}

      <View style={[styles.fab, { bottom: insets.bottom + 80 }]}>
        <CaptureButton onPress={handleCapture} loading={capturing} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyImage: {
    width: 200,
    height: 200,
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  fab: {
    position: 'absolute',
    right: 20,
    alignItems: 'center',
  },
});
