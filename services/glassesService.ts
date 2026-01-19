import { MediaItem, DeviceStatus, CaptureSettings } from '@/types';

// Simulated device connection
export const glassesService = {
  // Get device status
  getDeviceStatus: async (): Promise<DeviceStatus> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      connected: true,
      battery: 78,
      storage: {
        used: 45.2,
        total: 128,
      },
      model: 'Ray-Ban Stories',
      lastSync: Date.now() - 1000 * 60 * 5, // 5 minutes ago
    };
  },

  // Get mock media from glasses
  getMedia: async (): Promise<MediaItem[]> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const mockItems: MediaItem[] = [];
    
    // Generate mock photos
    for (let i = 0; i < 12; i++) {
      mockItems.push({
        id: `photo-${i}`,
        type: 'photo',
        uri: `https://images.unsplash.com/photo-${1500000000000 + i * 100000}?w=800&h=600&fit=crop`,
        thumbnail: `https://images.unsplash.com/photo-${1500000000000 + i * 100000}?w=200&h=200&fit=crop`,
        timestamp: Date.now() - i * 1000 * 60 * 30,
        location: i % 3 === 0 ? 'San Francisco, CA' : undefined,
        aiCaption: i % 2 === 0 ? 'Beautiful sunset at the beach' : undefined,
      });
    }

    // Add mock videos
    for (let i = 0; i < 4; i++) {
      mockItems.push({
        id: `video-${i}`,
        type: 'video',
        uri: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`,
        thumbnail: `https://images.unsplash.com/photo-${1600000000000 + i * 100000}?w=200&h=200&fit=crop`,
        timestamp: Date.now() - i * 1000 * 60 * 60,
        duration: 15 + i * 5,
        location: 'New York, NY',
      });
    }

    return mockItems.sort((a, b) => b.timestamp - a.timestamp);
  },

  // Simulate taking a photo
  takePhoto: async (): Promise<MediaItem> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      id: `photo-new-${Date.now()}`,
      type: 'photo',
      uri: `https://images.unsplash.com/photo-1${Date.now()}?w=800&h=600&fit=crop`,
      thumbnail: `https://images.unsplash.com/photo-1${Date.now()}?w=200&h=200&fit=crop`,
      timestamp: Date.now(),
    };
  },

  // Simulate starting video recording
  startVideo: async (): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return `recording-${Date.now()}`;
  },

  // Simulate stopping video recording
  stopVideo: async (recordingId: string): Promise<MediaItem> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return {
      id: `video-${Date.now()}`,
      type: 'video',
      uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      thumbnail: `https://images.unsplash.com/photo-${Date.now()}?w=200&h=200&fit=crop`,
      timestamp: Date.now(),
      duration: 12,
    };
  },

  // Get capture settings
  getSettings: async (): Promise<CaptureSettings> => {
    const stored = localStorage.getItem('capture-settings');
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
    await new Promise(resolve => setTimeout(resolve, 300));
    localStorage.setItem('capture-settings', JSON.stringify(settings));
  },

  // Sync media from glasses
  syncMedia: async (): Promise<number> => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return Math.floor(Math.random() * 5) + 1; // Random 1-5 new items
  },
};
