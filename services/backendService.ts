import { getSupabaseClient } from '@/template';
import { MediaItem, AIMessage, Album, DeviceStatus } from '@/types';
import { FunctionsHttpError } from '@supabase/supabase-js';

const supabase = new Proxy({} as any, {
  get(target, prop, receiver) {
    return Reflect.get(getSupabaseClient(), prop, receiver);
  }
});
const getBackendUrl = () => process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.154:5000';

export const backendService = {
  // Media operations
  async uploadMedia(item: MediaItem, userId: string): Promise<void> {
    try {
      const backendUrl = getBackendUrl();
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('device_id', 'esp32_01');
      
      if (item.uri) {
        const filename = item.uri.split('/').pop() || 'upload.jpg';
        const type = item.type === 'video' ? 'video/mp4' : 'image/jpeg';
        formData.append('file', {
          uri: item.uri,
          name: filename,
          type: type,
        } as any);
      }

      const response = await fetch(`${backendUrl}/upload_media`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Upload failed: ${errText}`);
      }
    } catch (error) {
      console.error('Local uploadMedia failed, trying Supabase fallback...', error);
      // Fallback to Supabase if local upload fails
      const { error: supabaseError } = await supabase.from('media_items').insert({
        user_id: userId,
        type: item.type,
        uri: item.uri,
        thumbnail: item.thumbnail,
        duration: item.duration,
        location: item.location,
        ai_caption: item.aiCaption,
        ai_tags: item.aiTags || [],
        synced: true,
      });
      if (supabaseError) throw supabaseError;
    }
  },

  async fetchMedia(userId: string): Promise<MediaItem[]> {
    try {
      const backendUrl = getBackendUrl();
      const response = await fetch(`${backendUrl}/api/media?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        return (data || []).map((item: any) => {
          let uri = item.uri || item.url;
          if (uri && (uri.includes('localhost') || uri.includes('127.0.0.1'))) {
            const host = backendUrl.replace('http://', '').replace('https://', '');
            uri = uri.replace('localhost:5000', host).replace('127.0.0.1:5000', host);
          }
          return {
            id: item.id,
            type: item.type,
            uri: uri,
            thumbnail: uri,
            timestamp: new Date(item.created_at).getTime(),
            duration: item.duration,
            location: item.location,
            aiCaption: item.ai_caption,
            aiTags: item.ai_tags || [],
            synced: true,
          };
        });
      }
    } catch (error) {
      console.warn('Local fetchMedia failed, falling back to Supabase...', error);
    }

    // Supabase fallback
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      type: item.type,
      uri: item.uri || item.url,
      thumbnail: item.thumbnail || item.uri || item.url,
      timestamp: new Date(item.created_at).getTime(),
      duration: item.duration,
      location: item.location,
      aiCaption: item.ai_caption,
      aiTags: item.ai_tags || [],
      synced: true,
    }));
  },

  async updateMediaCaption(mediaId: string, caption: string, tags: string[]): Promise<void> {
    const { error } = await supabase
      .from('media_items')
      .update({ ai_caption: caption, ai_tags: tags })
      .eq('id', mediaId);

    if (error) throw error;
  },

  async deleteMedia(mediaId: string, storagePath?: string): Promise<void> {
    // 1. Delete from storage if path provided
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([storagePath]);
      if (storageError) console.warn('Storage delete error:', storageError);
    }

    // 2. Delete from database
    const { error } = await supabase
      .from('media_items')
      .delete()
      .eq('id', mediaId);

    if (error) throw error;
  },

  // Album operations
  async createAlbum(album: Omit<Album, 'id'>, userId: string): Promise<string> {
    const { data, error } = await supabase
      .from('albums')
      .insert({
        user_id: userId,
        name: album.name,
        type: album.type,
        cover_uri: album.coverUri,
        metadata: album.metadata || {},
        item_count: album.itemCount,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  },

  async fetchAlbums(userId: string): Promise<Album[]> {
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(album => ({
      id: album.id,
      name: album.name,
      type: album.type,
      coverUri: album.cover_uri,
      itemCount: album.item_count,
      metadata: album.metadata,
      createdAt: new Date(album.created_at).getTime(),
    }));
  },

  // AI Chat operations
  async sendChatMessage(message: string, userId: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('ai-chat', {
      body: { message, userId },
    });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
        } catch {
          errorMessage = `${error.message || 'Failed to send message'}`;
        }
      }
      throw new Error(errorMessage);
    }

    return data.message;
  },

  async fetchChatHistory(userId: string): Promise<AIMessage[]> {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at).getTime(),
      synced: true,
    }));
  },

  // Media analysis
  async analyzeMedia(imageUri: string): Promise<{ caption: string; tags: string[] }> {
    const backendUrl = getBackendUrl();
    try {
      const response = await fetch(`${backendUrl}/analyze_media`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUri }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze media via backend');
      }

      const data = await response.json();
      return {
        caption: data.caption || '',
        tags: data.tags || [],
      };
    } catch (error) {
      console.error('analyzeMedia error:', error);
      throw error;
    }
  },

  // Direct Tigo backend Chat
  async chatWithTigo(message: string, userId: string, deviceId: string): Promise<{ text: string; audio_url: string }> {
    const backendUrl = getBackendUrl();
    console.log(`[backendService] Chatting with Tigo at: ${backendUrl}/transcribe_text`);
    try {
      const response = await fetch(`${backendUrl}/transcribe_text`, { // I'll add this endpoint to app.py
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message, user_id: userId, device_id: deviceId }),
      });
      if (!response.ok) {
        throw new Error('Failed to talk to Tigo backend');
      }
      return await response.json();
    } catch (error) {
      console.error('chatWithTigo error:', error);
      throw error;
    }
  },
  // Device Commands
  async sendDeviceCommand(deviceId: string, command: string): Promise<void> {
    const backendUrl = getBackendUrl();
    try {
      const response = await fetch(`${backendUrl}/send_command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ device_id: deviceId, command }),
      });
      if (!response.ok) {
        throw new Error('Failed to send command to device');
      }
    } catch (error) {
      console.error('sendDeviceCommand error:', error);
      throw error;
    }
  },
  async getDeviceStatus(deviceId: string = 'esp32_01', userId: string = 'guest_user'): Promise<DeviceStatus> {
    const backendUrl = getBackendUrl();
    try {
      const response = await fetch(`${backendUrl}/device_status/${deviceId}?user_id=${userId}`);
      if (response.ok) {
        const data = await response.json();
        return {
          connected: data.connected,
          battery: data.battery,
          storage: data.storage,
          model: data.model,
          systemError: data.system_error,
        };
      }
    } catch (error) {
      console.warn('Error fetching device status:', error);
    }
    return {
      connected: false,
      battery: 0,
      storage: {
        used: 0.0,
        total: 0.0,
      },
      model: 'TIGOAI SmartGlasses',
    };
  },
  supabase,
};
