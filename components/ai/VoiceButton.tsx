import React from 'react';
import { Pressable, StyleSheet, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

interface VoiceButtonProps {
  listening: boolean;
  onPress: () => void;
}

export function VoiceButton({ listening, onPress }: VoiceButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (listening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [listening, scaleAnim]);

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.pressed,
        ]}
      >
        <LinearGradient
          colors={listening ? [theme.colors.error, '#FF6B6B'] : [theme.colors.primary, theme.colors.secondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <MaterialIcons
            name={listening ? 'mic' : 'mic-none'}
            size={32}
            color="#fff"
          />
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
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
});
