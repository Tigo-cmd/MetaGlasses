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

  const loadMessages = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const userId = user?.id || 'guest_user';
      console.log(`[useAI] Fetching fresh messages for: ${userId}...`);
      // Try to load from backend first if online
      const online = await offlineService.isOnline();
      if (online) {
        const backendMessages = await backendService.fetchChatHistory(userId);
        setMessages(backendMessages);
        // Save to offline storage
        await offlineService.saveMessages(backendMessages);
      } else {
        // Load from offline storage
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
  }, [user]);

  // Load messages on mount and subscribe to realtime updates
  useEffect(() => {
    const userId = user?.id || 'guest_user';
    console.log(`[useAI] Monitoring chat for user: ${userId}`);
    loadMessages(true);

    const { supabase } = backendService;
    const channel = supabase
      .channel(`chat_changes_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen for all events (Insert/Update)
          schema: 'public',
          table: 'chat_messages',
        },
        (payload: any) => {
          // Filter in JS for maximum reliability
          if (payload.new && payload.new.user_id === userId) {
            console.log(`[useAI] 💬 PROACTIVE UPDATE: ${payload.eventType}`);

            const msgRow = payload.new;
            const newMessage: AIMessage = {
              id: msgRow.id,
              role: msgRow.role as 'user' | 'assistant',
              content: msgRow.content,
              timestamp: new Date(msgRow.timestamp || msgRow.created_at).getTime(),
              synced: true,
              audioUrl: msgRow.audio_url || undefined,
            };

            setMessages(prev => {
              // If it's an update, replace the existing message
              if (payload.eventType === 'UPDATE') {
                return prev.map(m => m.id === msgRow.id ? newMessage : m);
              }
              // If it's an insert, add if not exists
              if (prev.some(m => m.id === newMessage.id)) return prev;
              return [...prev, newMessage];
            });

            // Silent background sync for safety
            loadMessages(false);
          }
        }
      )
      .subscribe((status) => {
        console.log(`[useAI] 🌐 Realtime Status: ${status} (UserID: ${userId})`);
      });

    // Subscribe to network changes
    const unsubscribeNetwork = offlineService.onNetworkChange(async (connected) => {
      setIsOnline(connected);
      if (connected && user) {
        await syncQueuedMessages();
      }
    });

    return () => {
      console.log(`[useAI] Cleaning up Monitoring for: ${userId}`);
      if (channel) supabase.removeChannel(channel);
      unsubscribeNetwork();
    };
  }, [user, loadMessages]);

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

    const userId = user?.id || 'guest_user';
    console.log(`[useAI] Attempting to send message for user: ${userId}`);

    try {
      // Always attempt to send to backend first
      try {
        const result = await backendService.chatWithTigo(content, userId, 'app_instance');
        console.log('[useAI] Backend responded successfully');

        const assistantMessage: AIMessage = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: result.text,
          timestamp: Date.now(),
          synced: true,
          audioUrl: result.audio_url,
        };

        const updatedMessages = [
          ...messages,
          { ...userMessage, synced: true },
          assistantMessage,
        ];
        setMessages(updatedMessages);
        await offlineService.saveMessages(updatedMessages);

        return assistantMessage;
      } catch (fetchError) {
        console.warn('[useAI] Online fetch failed, queuing for later:', fetchError);
        // Fall through to offline handling
        await offlineService.addToQueue({
          type: 'send_message',
          data: { message: content },
        });

        // Still show the message in the list
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        await offlineService.saveMessages(updatedMessages);
      }
    } catch (error) {
      console.error('AI request failed:', error);

      // Save to queue on error if not already caught
      await offlineService.addToQueue({
        type: 'send_message',
        data: { message: content },
      });

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      await offlineService.saveMessages(updatedMessages);
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
