export interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  uri: string;
  thumbnail: string;
  timestamp: number;
  duration?: number;
  location?: string;
  aiCaption?: string;
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
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  waveform?: number[];
}

export interface CaptureSettings {
  photoResolution: '1080p' | '4K';
  videoQuality: '1080p' | '4K';
  autoSync: boolean;
  voiceActivation: boolean;
}
