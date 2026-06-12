import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function IndexScreen() {
  const router = useRouter();
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.8);
  const translateY = useSharedValue(20);

  const navigate = (path: string) => {
    router.replace(path as any);
  };

  useEffect(() => {
    // Start animation
    opacity.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.exp) });
    scale.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.exp) });
    translateY.value = withTiming(0, { duration: 1000, easing: Easing.out(Easing.exp) });

    const checkOnboarding = async () => {
      try {
        const hasSeenOnboarding = await AsyncStorage.getItem('hasSeenOnboarding');

        // Wait for animation to finish then navigate
        setTimeout(() => {
          if (hasSeenOnboarding) {
            navigate('/(tabs)');
          } else {
            navigate('/onboarding');
          }
        }, 2500);
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        navigate('/onboarding');
      }
    };

    checkOnboarding();
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [
        { scale: scale.value },
        { translateY: translateY.value }
      ],
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, animatedStyle]}>
        <Image
          source={require('@/assets/images/tigoai_logo.png')}
          style={styles.logo}
          contentFit="contain"
        />
        <Animated.Text style={styles.title}>TigoAI</Animated.Text>
        <Animated.Text style={styles.subtitle}>Intelligence Beyond Limits</Animated.Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: width * 0.6,
    height: width * 0.6,
    marginBottom: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
    textShadowColor: 'rgba(0, 163, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 10,
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
});
