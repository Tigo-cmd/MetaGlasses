import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MediaItem, DeviceStatus, CaptureSettings, Album } from '@/types';
import { glassesService } from '@/services/glassesService';
import { backendService } from '@/services/backendService';
import { offlineService } from '@/services/offlineService';
import { organizeIntoAlbums } from '@/services/albumService';
import { useAuth } from '@/template';

interface GlassesContextType {
    deviceStatus: DeviceStatus | null;
    media: MediaItem[];
    albums: Album[];
    settings: CaptureSettings | null;
    loading: boolean;
    syncing: boolean;
    capturing: boolean;
    isOnline: boolean;
    syncMedia: () => Promise<number>;
    takePhoto: () => Promise<void>;
    analyzeMedia: (mediaItem: MediaItem) => Promise<{ caption: string; tags: string[] }>;
    deleteMedia: (mediaItem: MediaItem) => Promise<void>;
    updateSettings: (newSettings: CaptureSettings) => Promise<void>;
    refreshStatus: () => Promise<void>;
    loadInitialData: (showLoading?: boolean) => Promise<void>;
}

const GlassesContext = createContext<GlassesContextType | undefined>(undefined);

export function GlassesProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
    const [media, setMedia] = useState<MediaItem[]>([]);
    const [albums, setAlbums] = useState<Album[]>([]);
    const [settings, setSettings] = useState<CaptureSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [capturing, setCapturing] = useState(false);
    const [isOnline, setIsOnline] = useState(true);

    const loadInitialData = useCallback(async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const userId = user?.id || 'guest_user';
            console.log(`[GlassesProvider] Fetching data for: ${userId}...`);

            const [statusData, settingsData] = await Promise.all([
                glassesService.getDeviceStatus('esp32_01', userId),
                glassesService.getSettings(),
            ]);
            setDeviceStatus(statusData);
            setSettings(settingsData);

            try {
                const backendMedia = await backendService.fetchMedia(userId);
                setMedia(backendMedia);
                await offlineService.saveMedia(backendMedia);
                setAlbums(organizeIntoAlbums(backendMedia));
            } catch (backendError: any) {
                console.warn('[GlassesContext] Failed to fetch media from backend, falling back to offline cache:', backendError?.message || backendError);
                const offlineMedia = await offlineService.getMedia();
                setMedia(offlineMedia || []);
                setAlbums(organizeIntoAlbums(offlineMedia || []));
            }
        } catch (error: any) {
            console.error('Failed to load initial data:', error?.message || error);
            if (error && typeof error === 'object') {
                console.error('Detailed Error Object:', JSON.stringify(error, null, 2));
            }
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [user]);

    const syncOfflineData = useCallback(async () => {
        if (!user) return;
        try {
            const queue = await offlineService.getQueue();
            const mediaItems = queue.filter(item => item.type === 'upload_media');
            for (const item of mediaItems) {
                try {
                    await backendService.uploadMedia(item.data, user.id);
                    await offlineService.removeFromQueue(item.id);
                } catch (e) { }
            }
            await loadInitialData(false);
        } catch (e) { }
    }, [user, loadInitialData]);

    // Realtime Subscription
    useEffect(() => {
        const userId = user?.id || 'guest_user';
        loadInitialData(true);

        const { supabase } = backendService;
        const channelName = `media_global_${userId}`;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'media_items' },
                async (payload: any) => {
                    const record = payload.new || payload.old;
                    if (record && record.user_id === userId) {
                        console.log(`[GlassesProvider] 📢 Realtime Event: ${payload.eventType}`);

                        if (payload.eventType === 'INSERT') {
                            const newItem: MediaItem = {
                                id: payload.new.id,
                                type: payload.new.type,
                                uri: payload.new.uri || payload.new.url,
                                thumbnail: payload.new.thumbnail || payload.new.uri || payload.new.url,
                                timestamp: new Date(payload.new.created_at).getTime(),
                                aiCaption: payload.new.ai_caption,
                                aiTags: payload.new.ai_tags || [],
                                synced: true,
                            };
                            setMedia(prev => [newItem, ...prev.filter(m => m.id !== newItem.id)]);
                        } else if (payload.eventType === 'UPDATE') {
                            setMedia(prev => prev.map(m => m.id === payload.new.id ? {
                                ...m,
                                aiCaption: payload.new.ai_caption,
                                aiTags: payload.new.ai_tags || [],
                                uri: payload.new.uri || payload.new.url || m.uri,
                            } : m));
                        } else if (payload.eventType === 'DELETE') {
                            setMedia(prev => prev.filter(m => m.id !== payload.old.id));
                        }
                        // Trigger background refresh for secondary data (albums)
                        setTimeout(() => loadInitialData(false), 500);
                    }
                }
            )
            .subscribe();

        const unsubscribeNetwork = offlineService.onNetworkChange(async (connected) => {
            setIsOnline(connected);
            if (connected) await syncOfflineData();
        });

        return () => {
            supabase.removeChannel(channel);
            unsubscribeNetwork();
        };
    }, [user?.id, loadInitialData, syncOfflineData]);

    // Sync albums when media changes
    useEffect(() => {
        setAlbums(organizeIntoAlbums(media));
    }, [media]);

    useEffect(() => {
        const interval = setInterval(async () => {
            await refreshStatus();
            try {
                const userId = user?.id || 'guest_user';
                const backendMedia = await backendService.fetchMedia(userId);
                setMedia(backendMedia);
                await offlineService.saveMedia(backendMedia);
            } catch (e: any) {
                console.warn('[GlassesContext] Interval media fetch failed:', e?.message || e);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [refreshStatus, user?.id]);

    const syncMedia = useCallback(async () => {
        if (!user || syncing) return 0;
        setSyncing(true);
        try {
            await glassesService.syncMedia(user.id);
            await loadInitialData(false);
            return 1;
        } catch (error) {
            console.error('[GlassesContext] syncMedia failed:', error);
            return 0;
        } finally {
            setSyncing(false);
        }
    }, [user, syncing, loadInitialData]);

    const takePhoto = useCallback(async () => {
        if (capturing) return;
        setCapturing(true);
        try {
            await glassesService.takePhoto();
        } finally {
            setCapturing(false);
        }
    }, [capturing]);

    const analyzeMedia = useCallback(async (mediaItem: MediaItem) => {
        const result = await backendService.analyzeMedia(mediaItem.uri);
        if (user) {
            await backendService.updateMediaCaption(mediaItem.id, result.caption, result.tags);
        }
        setMedia(prev => prev.map(m => m.id === mediaItem.id ? { ...m, aiCaption: result.caption, aiTags: result.tags } : m));
        return result;
    }, [user]);

    const deleteMedia = useCallback(async (mediaItem: MediaItem) => {
        const online = await offlineService.isOnline();
        if (online) {
            let storagePath: string | undefined;
            if (mediaItem.uri.includes('/media/')) storagePath = mediaItem.uri.split('/media/')[1];
            await backendService.deleteMedia(mediaItem.id, storagePath);
        }

        setMedia(prev => {
            const updated = prev.filter(m => m.id !== mediaItem.id);
            offlineService.saveMedia(updated); // Side effect is okay here as it's just local storage
            return updated;
        });
    }, []);

    const updateSettings = useCallback(async (s: CaptureSettings) => {
        await glassesService.updateSettings(s);
        setSettings(s);
    }, []);

    const refreshStatus = useCallback(async () => {
        const userId = user?.id || 'guest_user';
        const s = await glassesService.getDeviceStatus('esp32_01', userId);
        setDeviceStatus(s);
    }, [user?.id]);

    return (
        <GlassesContext.Provider value={{
            deviceStatus, media, albums, settings, loading, syncing, capturing, isOnline,
            syncMedia, takePhoto, analyzeMedia, deleteMedia, updateSettings, refreshStatus, loadInitialData
        }}>
            {children}
        </GlassesContext.Provider>
    );
}

export const useGlassesContext = () => {
    const context = useContext(GlassesContext);
    if (!context) throw new Error('useGlassesContext must be used within a GlassesProvider');
    return context;
};
