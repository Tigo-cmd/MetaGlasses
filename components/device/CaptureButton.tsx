import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface CaptureButtonProps {
  onPress: () => void;
  loading?: boolean;
  icon?: 'camera' | 'videocam';
}

export function CaptureButton({ onPress, loading = false, icon = 'camera' }: CaptureButtonProps) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        disabled={loading}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={[theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <MaterialIcons
            name={icon}
            size={28}
            color="#fff"
          />
        </LinearGradient>
      </Pressable>

      {loading && (
        <View style={styles.ring} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  gradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.95 }],
  },
  ring: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: 32,
    opacity: 0.5,
  },
});
