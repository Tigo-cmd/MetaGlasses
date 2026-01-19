import React from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { MediaItem } from '@/types';
import { MediaCard } from './MediaCard';

interface MediaGridProps {
  media: MediaItem[];
  onMediaPress: (item: MediaItem) => void;
}

export function MediaGrid({ media, onMediaPress }: MediaGridProps) {
  const numColumns = 3;
  const spacing = 4;
  const { width } = Dimensions.get('window');
  const itemSize = (width - spacing * (numColumns + 1)) / numColumns;

  return (
    <View style={styles.container}>
      {media.map((item, index) => (
        <View
          key={item.id}
          style={[
            styles.item,
            {
              width: itemSize,
              height: itemSize,
              marginLeft: index % numColumns === 0 ? 0 : spacing,
              marginTop: index < numColumns ? 0 : spacing,
            },
          ]}
        >
          <MediaCard item={item} onPress={() => onMediaPress(item)} size={itemSize} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 4,
  },
  item: {
    overflow: 'hidden',
  },
});
