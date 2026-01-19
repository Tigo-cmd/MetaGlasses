import { useState, useCallback } from 'react';
import { AIMessage } from '@/types';
import { aiService } from '@/services/aiService';

export function useAI() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [listening, setListening] = useState(false);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || processing) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setProcessing(true);

    try {
      const response = await aiService.sendMessage(content);
      setMessages(prev => [...prev, response]);
      return response;
    } catch (error) {
      console.error('AI request failed:', error);
      throw error;
    } finally {
      setProcessing(false);
    }
  }, [processing]);

  const startListening = useCallback(() => {
    setListening(true);
  }, []);

  const stopListening = useCallback(async (audioData?: Float32Array) => {
    setListening(false);
    
    if (audioData) {
      try {
        const transcription = await aiService.processVoice(audioData);
        await sendMessage(transcription);
      } catch (error) {
        console.error('Voice processing failed:', error);
      }
    }
  }, [sendMessage]);

  const generateCaption = useCallback(async (imageUri: string) => {
    try {
      const caption = await aiService.generateCaption(imageUri);
      return caption;
    } catch (error) {
      console.error('Caption generation failed:', error);
      throw error;
    }
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    processing,
    listening,
    sendMessage,
    startListening,
    stopListening,
    generateCaption,
    clearHistory,
  };
}
