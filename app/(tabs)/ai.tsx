import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAI } from '@/hooks/useAI';
import { ChatBubble, VoiceButton } from '@/components';
import { theme } from '@/constants/theme';

export default function AIScreen() {
  const insets = useSafeAreaInsets();
  const { messages, processing, listening, sendMessage, startListening, stopListening } = useAI();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim() || processing) return;
    
    const text = inputText.trim();
    setInputText('');
    await sendMessage(text);
  };

  const handleVoicePress = () => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialIcons name="auto-awesome" size={24} color={theme.colors.ai} />
          </View>
          <View>
            <Text style={styles.title}>AI Assistant</Text>
            <Text style={styles.subtitle}>Powered by Meta AI</Text>
          </View>
        </View>

        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="psychology" size={80} color={theme.colors.surfaceLight} />
            <Text style={styles.emptyTitle}>Hey! How can I help?</Text>
            <Text style={styles.emptyText}>
              Ask me anything about your glasses, capture moments, or describe what you see
            </Text>
            
            <View style={styles.suggestions}>
              <Pressable style={styles.suggestion} onPress={() => sendMessage('Take a photo')}>
                <Text style={styles.suggestionText}>📸 Take a photo</Text>
              </Pressable>
              <Pressable style={styles.suggestion} onPress={() => sendMessage('Show recent photos')}>
                <Text style={styles.suggestionText}>🖼️ Show recent photos</Text>
              </Pressable>
              <Pressable style={styles.suggestion} onPress={() => sendMessage('Check battery status')}>
                <Text style={styles.suggestionText}>🔋 Battery status</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ChatBubble message={item} />}
            contentContainerStyle={[
              styles.messageList,
              { paddingBottom: insets.bottom + 100 }
            ]}
            showsVerticalScrollIndicator={false}
          />
        )}

        <View style={[styles.inputContainer, { paddingBottom: insets.bottom + 8 }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Ask me anything..."
              placeholderTextColor={theme.colors.textTertiary}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
              multiline
              maxLength={500}
            />
            
            {inputText.trim() ? (
              <Pressable
                onPress={handleSend}
                disabled={processing}
                style={[styles.sendButton, processing && styles.sendButtonDisabled]}
              >
                <MaterialIcons name="send" size={24} color="#fff" />
              </Pressable>
            ) : (
              <VoiceButton listening={listening} onPress={handleVoicePress} />
            )}
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  suggestions: {
    gap: 12,
    width: '100%',
  },
  suggestion: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: theme.borderRadius.lg,
  },
  suggestionText: {
    fontSize: 16,
    color: theme.colors.text,
    fontWeight: '500',
  },
  messageList: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  inputContainer: {
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
