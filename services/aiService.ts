import { AIMessage } from '@/types';

// Simulated AI responses
const aiResponses = [
  "I can help you capture that moment. Just say 'Hey Meta, take a photo' or press the capture button.",
  "Your glasses are connected and ready. Battery at 78%. Would you like to review your recent photos?",
  "I see you have 16 photos and videos from today. The sunset shots look beautiful!",
  "To take a video, simply say 'Hey Meta, start recording' or press and hold the capture button.",
  "Your storage is at 35% capacity. You have room for approximately 150 more photos.",
  "I can describe what your glasses see. Would you like me to analyze the current view?",
  "The latest photo shows a cityscape at golden hour. Great composition and lighting!",
  "Voice commands are enabled. You can ask me to take photos, record videos, or describe what you see.",
  "Your photos are automatically syncing. The last sync was 5 minutes ago with 3 new items.",
  "Would you like me to organize your media by location or date? I can create albums for you.",
];

export const aiService = {
  // Send message to AI
  sendMessage: async (message: string): Promise<AIMessage> => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    // Generate random waveform for voice visualization
    const waveform = Array.from({ length: 20 }, () => Math.random() * 0.8 + 0.2);
    
    const response = aiResponses[Math.floor(Math.random() * aiResponses.length)];
    
    return {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: Date.now(),
      waveform,
    };
  },

  // Process voice input (simulated)
  processVoice: async (audioData: Float32Array): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 800));
    const commands = [
      'Take a photo',
      'Start recording video',
      'Show me recent photos',
      "What's in front of me?",
      'How much battery do I have?',
    ];
    return commands[Math.floor(Math.random() * commands.length)];
  },

  // Generate AI caption for image
  generateCaption: async (imageUri: string): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1500));
    const captions = [
      'A beautiful sunset over the ocean with vibrant orange and pink skies',
      'City skyline at night with illuminated buildings and reflections',
      'Close-up portrait with natural lighting and soft focus background',
      'Street scene with pedestrians and urban architecture',
      'Nature landscape with mountains and clear blue sky',
      'Indoor cafe setting with warm ambient lighting',
    ];
    return captions[Math.floor(Math.random() * captions.length)];
  },
};
