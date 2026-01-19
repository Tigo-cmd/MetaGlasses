import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem, AIMessage, OfflineQueueItem } from '@/types';
import NetInfo from '@react-native-community/netinfo';

const MEDIA_KEY = '@glasses_media';
const MESSAGES_KEY = '@glasses_messages';
const QUEUE_KEY = '@glasses_queue';

export const offlineService = {
  // Media storage
  async saveMedia(media: MediaItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(MEDIA_KEY, JSON.stringify(media));
    } catch (error) {
      console.error('Error saving media offline:', error);
    }
  },

  async getMedia(): Promise<MediaItem[]> {
    try {
      const data = await AsyncStorage.getItem(MEDIA_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading media offline:', error);
      return [];
    }
  },

  // Messages storage
  async saveMessages(messages: AIMessage[]): Promise<void> {
    try {
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
    } catch (error) {
      console.error('Error saving messages offline:', error);
    }
  },

  async getMessages(): Promise<AIMessage[]> {
    try {
      const data = await AsyncStorage.getItem(MESSAGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading messages offline:', error);
      return [];
    }
  },

  // Offline queue management
  async addToQueue(item: Omit<OfflineQueueItem, 'id' | 'timestamp'>): Promise<void> {
    try {
      const queue = await this.getQueue();
      const newItem: OfflineQueueItem = {
        ...item,
        id: Date.now().toString(),
        timestamp: Date.now(),
      };
      queue.push(newItem);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Error adding to offline queue:', error);
    }
  },

  async getQueue(): Promise<OfflineQueueItem[]> {
    try {
      const data = await AsyncStorage.getItem(QUEUE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading offline queue:', error);
      return [];
    }
  },

  async removeFromQueue(id: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const filtered = queue.filter(item => item.id !== id);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error removing from queue:', error);
    }
  },

  async clearQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([]));
    } catch (error) {
      console.error('Error clearing queue:', error);
    }
  },

  // Network status
  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      console.error('Error checking network status:', error);
      return false;
    }
  },

  // Subscribe to network changes
  onNetworkChange(callback: (isConnected: boolean) => void): () => void {
    const unsubscribe = NetInfo.addEventListener(state => {
      callback(state.isConnected ?? false);
    });
    return unsubscribe;
  },
};
