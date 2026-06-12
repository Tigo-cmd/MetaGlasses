import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { AIMessage } from '@/types';
import { theme } from '@/constants/theme';

interface ChatBubbleProps {
  message: AIMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = React.useState(false);
  const soundRef = React.useRef<Audio.Sound | null>(null);

  const handlePlayVoice = async () => {
    if (!message.audioUrl) return;

    try {
      if (soundRef.current) {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
          setIsPlaying(false);
        } else {
          await soundRef.current.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:5000';
      const fullUrl = message.audioUrl.startsWith('http')
        ? message.audioUrl
        : `${backendUrl}${message.audioUrl}`;

      const { sound } = await Audio.Sound.createAsync(
        { uri: fullUrl },
        { shouldPlay: true }
      );
      soundRef.current = sound;
      setIsPlaying(true);

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
          soundRef.current?.setPositionAsync(0);
        }
      });
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  React.useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  return (
    <View style={[styles.container, isUser ? styles.userContainer : styles.aiContainer]}>
      {!isUser && (
        <View style={styles.aiIcon}>
          <MaterialIcons name="auto-awesome" size={16} color={theme.colors.ai} />
        </View>
      )}

      <View style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}>
        <View style={styles.bubbleHeader}>
          <Text style={[styles.text, isUser ? styles.userText : styles.aiText]}>
            {message.content}
          </Text>
          {!isUser && message.audioUrl && (
            <Pressable onPress={handlePlayVoice} style={styles.playButton}>
              <MaterialIcons
                name={isPlaying ? "pause-circle" : "play-circle"}
                size={24}
                color={theme.colors.ai}
              />
            </Pressable>
          )}
        </View>

        {!isUser && (message.waveform || isPlaying) && (
          <View style={styles.waveform}>
            {(message.waveform || Array(15).fill(0.5)).slice(0, 15).map((value, index) => (
              <View
                key={index}
                style={[
                  styles.waveformBar,
                  { height: (isPlaying ? (Math.random() * 0.8 + 0.2) : value) * 20 },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  aiContainer: {
    justifyContent: 'flex-start',
  },
  aiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.lg,
  },
  userBubble: {
    backgroundColor: theme.colors.primary,
  },
  aiBubble: {
    backgroundColor: theme.colors.surface,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: theme.colors.text,
  },
  bubbleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  playButton: {
    marginLeft: 8,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 8,
    height: 20,
  },
  waveformBar: {
    width: 2,
    backgroundColor: theme.colors.ai,
    borderRadius: 1,
    opacity: 0.6,
  },
});
