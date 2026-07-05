export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  uri: string;
  thumbnail: string;
  timestamp: number;
  duration?: number;
  location?: string;
  aiCaption?: string;
  aiTags?: string[];
  synced?: boolean;
  localOnly?: boolean;
}

export interface Album {
  id: string;
  name: string;
  type: 'date' | 'location' | 'ai_content' | 'manual';
  coverUri?: string;
  itemCount: number;
  metadata?: Record<string, any>;
  createdAt: number;
  items?: MediaItem[];
}

export interface DeviceStatus {
  connected: boolean;
  battery: number;
  storage: {
    used: number;
    total: number;
  };
  model: string;
  lastSync?: number;
  systemError?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  waveform?: number[];
  synced?: boolean;
  audioUrl?: string;
}

export interface CaptureSettings {
  photoResolution: '1080p' | '4K';
  videoQuality: '1080p' | '4K';
  autoSync: boolean;
  voiceActivation: boolean;
}

export interface OfflineQueueItem {
  id: string;
  type: 'upload_media' | 'send_message' | 'create_album';
  data: any;
  timestamp: number;
}
