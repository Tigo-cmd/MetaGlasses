import AsyncStorage from '@react-native-async-storage/async-storage';
import { MediaItem, DeviceStatus, CaptureSettings } from '@/types';
import { backendService } from './backendService';

// Real device integration
export const glassesService = {
  getDeviceStatus: async (deviceId: string = 'esp32_01'): Promise<DeviceStatus> => {
    return await backendService.getDeviceStatus(deviceId);
  },

  // Simulate taking a photo (sends command to backend)
  takePhoto: async (deviceId: string = 'esp32_01'): Promise<void> => {
    await backendService.sendDeviceCommand(deviceId, 'take_photo');
  },

  // Get capture settings
  getSettings: async (): Promise<CaptureSettings> => {
    const stored = await AsyncStorage.getItem('capture-settings');
    if (stored) {
      return JSON.parse(stored);
    }
    return {
      photoResolution: '4K',
      videoQuality: '1080p',
      autoSync: true,
      voiceActivation: true,
    };
  },

  // Update capture settings
  updateSettings: async (settings: CaptureSettings): Promise<void> => {
    await AsyncStorage.setItem('capture-settings', JSON.stringify(settings));
  },

  // Sync media from backend
  syncMedia: async (userId: string): Promise<MediaItem[]> => {
    return await backendService.fetchMedia(userId);
  },
};
