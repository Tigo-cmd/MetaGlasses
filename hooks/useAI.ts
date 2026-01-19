import { useState, useEffect, useCallback } from 'react';
import { AIMessage } from '@/types';
import { backendService } from '@/services/backendService';
import { offlineService } from '@/services/offlineService';
import { useAuth } from '@/template';

export function useAI() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Load messages on mount
  useEffect(() => {
    loadMessages();
    
    // Subscribe to network changes
    const unsubscribe = offlineService.onNetworkChange(async (connected) => {
      setIsOnline(connected);
      if (connected && user) {
        // Sync queued messages when back online
        await syncQueuedMessages();
      }
    });

    return unsubscribe;
  }, [user]);

  const loadMessages = async () => {
    try {
      // Try to load from backend first if online
      if (user) {
        const online = await offlineService.isOnline();
        if (online) {
          const backendMessages = await backendService.fetchChatHistory(user.id);
          setMessages(backendMessages);
          // Save to offline storage
          await offlineService.saveMessages(backendMessages);
        } else {
          // Load from offline storage
          const offlineMessages = await offlineService.getMessages();
          setMessages(offlineMessages);
        }
      } else {
        // Not logged in, load from offline storage
        const offlineMessages = await offlineService.getMessages();
        setMessages(offlineMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      // Fallback to offline storage
      const offlineMessages = await offlineService.getMessages();
      setMessages(offlineMessages);
    } finally {
      setLoading(false);
    }
  };

  const syncQueuedMessages = async () => {
    if (!user) return;

    try {
      const queue = await offlineService.getQueue();
      const messageItems = queue.filter(item => item.type === 'send_message');

      for (const item of messageItems) {
        try {
          await backendService.sendChatMessage(item.data.message, user.id);
          await offlineService.removeFromQueue(item.id);
        } catch (error) {
          console.error('Failed to sync message:', error);
          // Keep in queue for next attempt
        }
      }

      // Reload messages after sync
      await loadMessages();
    } catch (error) {
      console.error('Error syncing queued messages:', error);
    }
  };

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || processing) return;

    const userMessage: AIMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      synced: false,
    };

    setMessages(prev => [...prev, userMessage]);
    setProcessing(true);

    try {
      const online = await offlineService.isOnline();
      
      if (online && user) {
        // Send to backend
        const response = await backendService.sendChatMessage(content, user.id);
        
        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
          synced: true,
        };

        const updatedMessages = [
          ...messages,
          { ...userMessage, synced: true },
          assistantMessage,
        ];
        setMessages(updatedMessages);
        await offlineService.saveMessages(updatedMessages);
        
        return assistantMessage;
      } else {
        // Offline mode - queue for later and provide local response
        await offlineService.addToQueue({
          type: 'send_message',
          data: { message: content },
        });

        const offlineResponse: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: 'Message saved. It will be sent when you are back online.',
          timestamp: Date.now(),
          synced: false,
        };

        const updatedMessages = [...messages, userMessage, offlineResponse];
        setMessages(updatedMessages);
        await offlineService.saveMessages(updatedMessages);
        
        return offlineResponse;
      }
    } catch (error) {
      console.error('AI request failed:', error);
      
      // Save to queue on error
      await offlineService.addToQueue({
        type: 'send_message',
        data: { message: content },
      });

      const errorMessage: AIMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: 'Could not send message. It has been saved and will be sent when connection is restored.',
        timestamp: Date.now(),
        synced: false,
      };

      const updatedMessages = [...messages, userMessage, errorMessage];
      setMessages(updatedMessages);
      await offlineService.saveMessages(updatedMessages);

      throw error;
    } finally {
      setProcessing(false);
    }
  }, [processing, user, messages]);

  const startListening = useCallback(() => {
    setListening(true);
  }, []);

  const stopListening = useCallback(async (transcription?: string) => {
    setListening(false);
    
    if (transcription) {
      await sendMessage(transcription);
    }
  }, [sendMessage]);

  const clearHistory = useCallback(async () => {
    setMessages([]);
    await offlineService.saveMessages([]);
  }, []);

  return {
    messages,
    processing,
    listening,
    loading,
    isOnline,
    sendMessage,
    startListening,
    stopListening,
    clearHistory,
  };
}
