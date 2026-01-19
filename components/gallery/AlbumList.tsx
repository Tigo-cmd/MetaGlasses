import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Album } from '@/types';
import { AlbumCard } from './AlbumCard';

interface AlbumListProps {
  albums: Album[];
  onAlbumPress: (album: Album) => void;
}

export function AlbumList({ albums, onAlbumPress }: AlbumListProps) {
  if (albums.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {albums.map(album => (
          <AlbumCard
            key={album.id}
            album={album}
            onPress={onAlbumPress}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 200,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
});
