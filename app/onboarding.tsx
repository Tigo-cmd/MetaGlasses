import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components';
import { theme } from '@/constants/theme';

const screens = [
  {
    image: require('@/assets/images/onboarding-1.png'),
    title: 'Connect Your Smart Glasses',
    description: 'Seamlessly pair your Ray-Ban Stories and control them from your phone',
  },
  {
    image: require('@/assets/images/onboarding-2.png'),
    title: 'AI Voice Assistant',
    description: 'Ask questions, capture moments, and get instant AI responses through your glasses',
  },
  {
    image: require('@/assets/images/onboarding-3.png'),
    title: 'Manage Your Media',
    description: 'Browse, organize, and share photos and videos captured from your perspective',
  },
];

export default function OnboardingScreen() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = Dimensions.get('window');

  const handleNext = () => {
    if (currentIndex < screens.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      localStorage.setItem('hasSeenOnboarding', 'true');
      router.replace('/(tabs)');
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    router.replace('/(tabs)');
  };

  const currentScreen = screens[currentIndex];
  const isLastScreen = currentIndex === screens.length - 1;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.imageContainer}>
        <Image
          source={currentScreen.image}
          style={[styles.image, { width: width * 0.8, height: height * 0.5 }]}
          contentFit="contain"
          transition={300}
        />
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.dots}>
          {screens.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <Text style={styles.title}>{currentScreen.title}</Text>
        <Text style={styles.description}>{currentScreen.description}</Text>

        <View style={styles.actions}>
          <Button
            title={isLastScreen ? 'Get Started' : 'Next'}
            onPress={handleNext}
            fullWidth
          />
          
          {!isLastScreen && (
            <Pressable onPress={handleSkip} style={styles.skipButton}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  content: {
    paddingHorizontal: 24,
    gap: 16,
  },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.surfaceLight,
  },
  dotActive: {
    width: 24,
    backgroundColor: theme.colors.primary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    gap: 12,
    marginTop: 8,
  },
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
});
