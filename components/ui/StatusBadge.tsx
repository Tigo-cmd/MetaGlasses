import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/constants/theme';

interface StatusBadgeProps {
  connected: boolean;
  battery?: number;
}

export function StatusBadge({ connected, battery }: StatusBadgeProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.dot, connected ? styles.dotConnected : styles.dotDisconnected]} />
      <Text style={styles.text}>
        {connected ? 'Connected' : 'Disconnected'}
      </Text>
      {connected && battery !== undefined && (
        <Text style={styles.battery}>{battery}%</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.full,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotConnected: {
    backgroundColor: theme.colors.success,
  },
  dotDisconnected: {
    backgroundColor: theme.colors.textTertiary,
  },
  text: {
    color: theme.colors.text,
    fontSize: 12,
    fontWeight: '500',
  },
  battery: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
});
