import { useState, useEffect, useCallback } from 'react';
import { MediaItem, DeviceStatus, CaptureSettings, Album } from '@/types';
import { glassesService } from '@/services/glassesService';
import { backendService } from '@/services/backendService';
import { offlineService } from '@/services/offlineService';
import { organizeIntoAlbums } from '@/services/albumService';
import { useAuth } from '@/template';

export function useGlasses() {
  const { user } = useAuth();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [settings, setSettings] = useState<CaptureSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Load initial data
  useEffect(() => {
    loadInitialData();

    // Subscribe to network changes
    const unsubscribe = offlineService.onNetworkChange(async (connected) => {
      setIsOnline(connected);
      if (connected && user) {
        await syncOfflineData();
      }
    });

    return unsubscribe;
  }, [user]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Always load device status and settings (local)
      const [statusData, settingsData] = await Promise.all([
        glassesService.getDeviceStatus(),
        glassesService.getSettings(),
      ]);
      setDeviceStatus(statusData);
      setSettings(settingsData);

      // Load media
      if (user) {
        const online = await offlineService.isOnline();
        if (online) {
          // Load from backend
          const backendMedia = await backendService.fetchMedia(user.id);
          setMedia(backendMedia);
          await offlineService.saveMedia(backendMedia);
          
          // Generate albums
          const generatedAlbums = organizeIntoAlbums(backendMedia);
          setAlbums(generatedAlbums);
        } else {
          // Load from offline storage
          const offlineMedia = await offlineService.getMedia();
          setMedia(offlineMedia);
          
          const generatedAlbums = organizeIntoAlbums(offlineMedia);
          setAlbums(generatedAlbums);
        }
      } else {
        // Not logged in, use local mock data
        const mediaData = await glassesService.getMedia();
        setMedia(mediaData);
        
        const generatedAlbums = organizeIntoAlbums(mediaData);
        setAlbums(generatedAlbums);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // Fallback to offline data
      const offlineMedia = await offlineService.getMedia();
      setMedia(offlineMedia);
      
      const generatedAlbums = organizeIntoAlbums(offlineMedia);
      setAlbums(generatedAlbums);
    } finally {
      setLoading(false);
    }
  };

  const syncOfflineData = async () => {
    if (!user) return;

    try {
      const queue = await offlineService.getQueue();
      const mediaItems = queue.filter(item => item.type === 'upload_media');

      for (const item of mediaItems) {
        try {
          await backendService.uploadMedia(item.data, user.id);
          await offlineService.removeFromQueue(item.id);
        } catch (error) {
          console.error('Failed to sync media:', error);
        }
      }

      // Reload after sync
      await loadInitialData();
    } catch (error) {
      console.error('Error syncing offline data:', error);
    }
  };

  const syncMedia = useCallback(async () => {
    if (!deviceStatus?.connected || syncing) return;
    
    try {
      setSyncing(true);
      const newItemsCount = await glassesService.syncMedia();
      
      // Reload media after sync
      await loadInitialData();
      
      // Update last sync time
      setDeviceStatus(prev => prev ? {
        ...prev,
        lastSync: Date.now(),
      } : null);
      
      return newItemsCount;
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    } finally {
      setSyncing(false);
    }
  }, [deviceStatus?.connected, syncing, user]);

  const takePhoto = useCallback(async () => {
    if (!deviceStatus?.connected || capturing) return;
    
    try {
      setCapturing(true);
      const newPhoto = await glassesService.takePhoto();
      
      // Add to local state
      const updatedMedia = [newPhoto, ...media];
      setMedia(updatedMedia);
      
      // Update albums
      const generatedAlbums = organizeIntoAlbums(updatedMedia);
      setAlbums(generatedAlbums);

      // Save offline
      await offlineService.saveMedia(updatedMedia);

      // Upload to backend if online and logged in
      const online = await offlineService.isOnline();
      if (online && user) {
        try {
          await backendService.uploadMedia(newPhoto, user.id);
        } catch (error) {
          console.error('Failed to upload to backend:', error);
          // Queue for later
          await offlineService.addToQueue({
            type: 'upload_media',
            data: newPhoto,
          });
        }
      } else {
        // Queue for later
        await offlineService.addToQueue({
          type: 'upload_media',
          data: newPhoto,
        });
        newPhoto.localOnly = true;
      }
      
      return newPhoto;
    } catch (error) {
      console.error('Photo capture failed:', error);
      throw error;
    } finally {
      setCapturing(false);
    }
  }, [deviceStatus?.connected, capturing, media, user]);

  const analyzeMedia = useCallback(async (mediaItem: MediaItem) => {
    try {
      const online = await offlineService.isOnline();
      if (!online) {
        throw new Error('Analysis requires internet connection');
      }

      const result = await backendService.analyzeMedia(mediaItem.uri);
      
      // Update media item
      const updatedMedia = media.map(item =>
        item.id === mediaItem.id
          ? { ...item, aiCaption: result.caption, aiTags: result.tags, synced: true }
          : item
      );
      setMedia(updatedMedia);
      
      // Update albums with new tags
      const generatedAlbums = organizeIntoAlbums(updatedMedia);
      setAlbums(generatedAlbums);

      // Save offline
      await offlineService.saveMedia(updatedMedia);

      // Update in backend if logged in
      if (user) {
        await backendService.updateMediaCaption(mediaItem.id, result.caption, result.tags);
      }

      return result;
    } catch (error) {
      console.error('Media analysis failed:', error);
      throw error;
    }
  }, [media, user]);

  const updateSettings = useCallback(async (newSettings: CaptureSettings) => {
    try {
      await glassesService.updateSettings(newSettings);
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const status = await glassesService.getDeviceStatus();
      setDeviceStatus(status);
    } catch (error) {
      console.error('Failed to refresh status:', error);
    }
  }, []);

  return {
    deviceStatus,
    media,
    albums,
    settings,
    loading,
    syncing,
    capturing,
    isOnline,
    syncMedia,
    takePhoto,
    analyzeMedia,
    updateSettings,
    refreshStatus,
  };
}
