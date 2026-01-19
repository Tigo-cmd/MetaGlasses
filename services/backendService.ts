import { getSupabaseClient } from '@/template';
import { MediaItem, AIMessage, Album } from '@/types';
import { FunctionsHttpError } from '@supabase/supabase-js';

const supabase = getSupabaseClient();

export const backendService = {
  // Media operations
  async uploadMedia(item: MediaItem, userId: string): Promise<void> {
    const { error } = await supabase.from('media_items').insert({
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

    if (error) throw error;
  },

  async fetchMedia(userId: string): Promise<MediaItem[]> {
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(item => ({
      id: item.id,
      type: item.type,
      uri: item.uri,
      thumbnail: item.thumbnail || item.uri,
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
    const { data, error } = await supabase.functions.invoke('analyze-media', {
      body: { imageUri },
    });

    if (error) {
      let errorMessage = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
        } catch {
          errorMessage = `${error.message || 'Failed to analyze media'}`;
        }
      }
      throw new Error(errorMessage);
    }

    return {
      caption: data.caption || '',
      tags: data.tags || [],
    };
  },
};
