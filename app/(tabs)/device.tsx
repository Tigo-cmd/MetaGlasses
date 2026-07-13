import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useGlasses } from '@/hooks/useGlasses';
import { DeviceCard, Button } from '@/components';
import { theme } from '@/constants/theme';
import { useAlert } from '@/template';

export default function DeviceScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { deviceStatus, settings, syncing, updateSettings, syncMedia, refreshStatus } = useGlasses();

  const handleToggle = async (key: 'autoSync' | 'voiceActivation', value: boolean) => {
    if (!settings) return;
    await updateSettings({ ...settings, [key]: value });
  };

  const handleSync = async () => {
    try {
      const newItems = await syncMedia();
      showAlert('Sync Complete', `${newItems} new items synced`);
    } catch (error) {
      showAlert('Sync Failed', 'Could not sync with glasses');
    }
  };

  const handleRefresh = async () => {
    await refreshStatus();
    showAlert('Status Updated', 'Device status refreshed');
  };

  if (!deviceStatus || !settings) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centerContent}>
          <Text style={styles.loadingText}>Loading device info...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Device</Text>
        <Pressable onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={24} color={theme.colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <DeviceCard status={deviceStatus} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <Button
            title={syncing ? 'Syncing...' : 'Sync Media Now'}
            onPress={handleSync}
            loading={syncing}
            fullWidth
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Capture Settings</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Auto Sync</Text>
              <Text style={styles.settingDescription}>
                Automatically sync media when connected
              </Text>
            </View>
            <Switch
              value={settings.autoSync}
              onValueChange={(value) => handleToggle('autoSync', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Voice Activation</Text>
              <Text style={styles.settingDescription}>
                Enable "Hey Tigo" voice commands
              </Text>
            </View>
            <Switch
              value={settings.voiceActivation}
              onValueChange={(value) => handleToggle('voiceActivation', value)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quality Settings</Text>

          <View style={styles.qualityRow}>
            <Text style={styles.settingLabel}>Photo Resolution</Text>
            <View style={styles.qualityButtons}>
              <Pressable
                style={[
                  styles.qualityButton,
                  settings.photoResolution === '1080p' && styles.qualityButtonActive,
                ]}
                onPress={() => updateSettings({ ...settings, photoResolution: '1080p' })}
              >
                <Text
                  style={[
                    styles.qualityButtonText,
                    settings.photoResolution === '1080p' && styles.qualityButtonTextActive,
                  ]}
                >
                  1080p
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.qualityButton,
                  settings.photoResolution === '4K' && styles.qualityButtonActive,
                ]}
                onPress={() => updateSettings({ ...settings, photoResolution: '4K' })}
              >
                <Text
                  style={[
                    styles.qualityButtonText,
                    settings.photoResolution === '4K' && styles.qualityButtonTextActive,
                  ]}
                >
                  4K
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.qualityRow}>
            <Text style={styles.settingLabel}>Video Quality</Text>
            <View style={styles.qualityButtons}>
              <Pressable
                style={[
                  styles.qualityButton,
                  settings.videoQuality === '1080p' && styles.qualityButtonActive,
                ]}
                onPress={() => updateSettings({ ...settings, videoQuality: '1080p' })}
              >
                <Text
                  style={[
                    styles.qualityButtonText,
                    settings.videoQuality === '1080p' && styles.qualityButtonTextActive,
                  ]}
                >
                  1080p
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.qualityButton,
                  settings.videoQuality === '4K' && styles.qualityButtonActive,
                ]}
                onPress={() => updateSettings({ ...settings, videoQuality: '4K' })}
              >
                <Text
                  style={[
                    styles.qualityButtonText,
                    settings.videoQuality === '4K' && styles.qualityButtonTextActive,
                  ]}
                >
                  4K
                </Text>
              </Pressable>
            </View>
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
  scrollContent: {
    paddingHorizontal: 20,
    gap: 24,
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
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
  },
  qualityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  qualityButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  qualityButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  qualityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  qualityButtonTextActive: {
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    padding: 16,
    borderRadius: theme.borderRadius.lg,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
