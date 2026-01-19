import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGlasses } from '@/hooks/useGlasses';
import { MediaGrid, StatusBadge, CaptureButton, AlbumList, OfflineIndicator } from '@/components';
import { theme } from '@/constants/theme';
import { useAlert } from '@/template';
import { Album } from '@/types';
import { searchMedia } from '@/services/albumService';

export default function GalleryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showAlert } = useAlert();
  const { deviceStatus, media, albums, loading, syncing, capturing, isOnline, syncMedia, takePhoto } = useGlasses();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);

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
      showAlert('Photo Captured', isOnline ? 'Photo saved successfully' : 'Photo saved offline');
    } catch (error) {
      showAlert('Capture Failed', 'Could not take photo. Please try again.');
    }
  };

  const handleMediaPress = (item: any) => {
    router.push(`/media/${item.id}`);
  };

  const handleAlbumPress = (album: Album) => {
    setSelectedAlbum(album);
    setSearchQuery('');
  };

  const handleClearFilter = () => {
    setSelectedAlbum(null);
    setSearchQuery('');
  };

  // Filter media based on search or selected album
  const filteredMedia = selectedAlbum
    ? selectedAlbum.items || []
    : searchQuery
    ? searchMedia(media, searchQuery)
    : media;

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
          <Text style={styles.subtitle}>
            {selectedAlbum ? selectedAlbum.name : `${media.length} items`}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <OfflineIndicator isOnline={isOnline} />
          {deviceStatus && (
            <StatusBadge connected={deviceStatus.connected} battery={deviceStatus.battery} />
          )}
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color={theme.colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by tags, location..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {(searchQuery || selectedAlbum) && (
            <Pressable onPress={handleClearFilter}>
              <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Albums Section */}
      {!searchQuery && !selectedAlbum && albums.length > 0 && (
        <View style={styles.albumsSection}>
          <Text style={styles.sectionTitle}>Albums</Text>
          <AlbumList albums={albums} onAlbumPress={handleAlbumPress} />
        </View>
      )}

      {/* Media Grid */}
      {filteredMedia.length === 0 ? (
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
          <Text style={styles.emptyTitle}>
            {searchQuery ? 'No Results' : selectedAlbum ? 'No Items' : 'No Media Yet'}
          </Text>
          <Text style={styles.emptyText}>
            {searchQuery
              ? 'Try a different search term'
              : selectedAlbum
              ? 'No items in this album yet'
              : 'Capture your first photo or video using your smart glasses'
            }
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
          {selectedAlbum && (
            <Pressable style={styles.filterChip} onPress={handleClearFilter}>
              <MaterialIcons name="filter-list" size={16} color={theme.colors.primary} />
              <Text style={styles.filterText}>{selectedAlbum.name}</Text>
              <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
            </Pressable>
          )}
          <MediaGrid media={filteredMedia} onMediaPress={handleMediaPress} />
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
  },
  albumsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 20,
    marginBottom: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
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
