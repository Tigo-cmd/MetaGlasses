import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { Album } from '@/types';
import { theme } from '@/constants/theme';

interface AlbumCardProps {
  album: Album;
  onPress: (album: Album) => void;
}

export function AlbumCard({ album, onPress }: AlbumCardProps) {
  const getIcon = () => {
    switch (album.type) {
      case 'date':
        return 'calendar-today';
      case 'location':
        return 'location-on';
      case 'ai_content':
        return 'auto-awesome';
      default:
        return 'folder';
    }
  };

  const getTypeColor = () => {
    switch (album.type) {
      case 'date':
        return theme.colors.primary;
      case 'location':
        return '#22c55e';
      case 'ai_content':
        return theme.colors.ai;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <Pressable
      onPress={() => onPress(album)}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: album.coverUri }}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.overlay}>
          <View style={[styles.typebadge, { backgroundColor: getTypeColor() }]}>
            <MaterialIcons name={getIcon()} size={16} color="#fff" />
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{album.itemCount}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{album.name}</Text>
        <Text style={styles.subtitle}>
          {album.itemCount} {album.itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    marginRight: 12,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  coverContainer: {
    width: 160,
    height: 160,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 8,
    justifyContent: 'space-between',
  },
  typeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  countBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-end',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  info: {
    marginTop: 8,
    gap: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    color: theme.colors.textSecondary,
  },
});
