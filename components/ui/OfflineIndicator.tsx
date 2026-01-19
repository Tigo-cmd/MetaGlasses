import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';

interface OfflineIndicatorProps {
  isOnline: boolean;
  queuedItems?: number;
}

export function OfflineIndicator({ isOnline, queuedItems = 0 }: OfflineIndicatorProps) {
  if (isOnline && queuedItems === 0) {
    return null;
  }

  return (
    <View style={[styles.container, !isOnline && styles.offline]}>
      <MaterialIcons
        name={isOnline ? 'sync' : 'cloud-off'}
        size={16}
        color="#fff"
      />
      <Text style={styles.text}>
        {isOnline
          ? `Syncing ${queuedItems} item${queuedItems !== 1 ? 's' : ''}...`
          : 'Offline Mode'
        }
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.primary,
  },
  offline: {
    backgroundColor: '#64748b',
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
});
