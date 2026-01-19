import { useState, useEffect, useCallback } from 'react';
import { MediaItem, DeviceStatus, CaptureSettings } from '@/types';
import { glassesService } from '@/services/glassesService';

export function useGlasses() {
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [settings, setSettings] = useState<CaptureSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [capturing, setCapturing] = useState(false);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [statusData, mediaData, settingsData] = await Promise.all([
        glassesService.getDeviceStatus(),
        glassesService.getMedia(),
        glassesService.getSettings(),
      ]);
      setDeviceStatus(statusData);
      setMedia(mediaData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncMedia = useCallback(async () => {
    if (!deviceStatus?.connected || syncing) return;
    
    try {
      setSyncing(true);
      const newItemsCount = await glassesService.syncMedia();
      
      // Reload media after sync
      const updatedMedia = await glassesService.getMedia();
      setMedia(updatedMedia);
      
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
  }, [deviceStatus?.connected, syncing]);

  const takePhoto = useCallback(async () => {
    if (!deviceStatus?.connected || capturing) return;
    
    try {
      setCapturing(true);
      const newPhoto = await glassesService.takePhoto();
      setMedia(prev => [newPhoto, ...prev]);
      return newPhoto;
    } catch (error) {
      console.error('Photo capture failed:', error);
      throw error;
    } finally {
      setCapturing(false);
    }
  }, [deviceStatus?.connected, capturing]);

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
    settings,
    loading,
    syncing,
    capturing,
    syncMedia,
    takePhoto,
    updateSettings,
    refreshStatus,
  };
}
