import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { DeviceStatus } from '@/types';
import { theme } from '@/constants/theme';

interface DeviceCardProps {
  status: DeviceStatus;
}

export function DeviceCard({ status }: DeviceCardProps) {
  const storagePercent = (status.storage.used / status.storage.total) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <MaterialIcons name="connected-tv" size={24} color={theme.colors.primary} />
          <Text style={styles.model}>{status.model}</Text>
        </View>
        <View style={[styles.statusDot, status.connected && styles.statusDotActive]} />
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <MaterialIcons name="battery-std" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.statLabel}>Battery</Text>
          <Text style={styles.statValue}>{status.battery}%</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.stat}>
          <MaterialIcons name="storage" size={20} color={theme.colors.textSecondary} />
          <Text style={styles.statLabel}>Storage</Text>
          <Text style={styles.statValue}>
            {status.storage.used.toFixed(1)} / {status.storage.total} GB
          </Text>
        </View>
      </View>

      <View style={styles.storageBar}>
        <View style={[styles.storageProgress, { width: `${storagePercent}%` }]} />
      </View>

      {status.lastSync && (
        <Text style={styles.syncText}>
          Last sync: {getRelativeTime(status.lastSync)}
        </Text>
      )}
    </View>
  );
}

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'Just now';
  if (minutes === 1) return '1 minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return '1 hour ago';
  return `${hours} hours ago`;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  model: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.textTertiary,
  },
  statusDotActive: {
    backgroundColor: theme.colors.success,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: theme.colors.border,
    marginHorizontal: 16,
  },
  storageBar: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  storageProgress: {
    height: '100%',
    backgroundColor: theme.colors.primary,
  },
  syncText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
});
