import React from 'react';
import { Pressable, StyleSheet, View, Text } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { MediaItem } from '@/types';
import { theme } from '@/constants/theme';

interface MediaCardProps {
  item: MediaItem;
  onPress: () => void;
  size: number;
}

export function MediaCard({ item, onPress, size }: MediaCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        { width: size, height: size },
        pressed && styles.pressed,
      ]}
    >
      <Image
        source={{ uri: item.thumbnail }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      
      {item.type === 'video' && (
        <View style={styles.overlay}>
          <MaterialIcons name="play-circle-filled" size={32} color="rgba(255,255,255,0.9)" />
          {item.duration && (
            <View style={styles.duration}>
              <Text style={styles.durationText}>
                {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
              </Text>
            </View>
          )}
        </View>
      )}

      {item.aiCaption && (
        <View style={styles.aiBadge}>
          <MaterialIcons name="auto-awesome" size={12} color={theme.colors.ai} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  duration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  aiBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderRadius: theme.borderRadius.full,
    padding: 4,
  },
});
