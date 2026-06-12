# TigoAI Application Analysis

## 1. Overview
TigoAI is a React Native mobile application designed to interface with smart glasses (simulated) and provide AI-powered features like visual analysis, chat, and media management.

## 2. Core Functionalities

### 2.1 Gallery (Main Screen)
- **Media Grid**: Displays photos and videos captured via the glasses.
- **Album Management**: Organizations media into system-generated and user-defined albums.
- **Search & Filter**: Allows searching media by name or filtering by album.
- **Sync**: Pull-to-refresh mechanism to sync media from the glasses to the phone and cloud.
- **Offline Support**: Uses `AsyncStorage` and a custom `offlineService` to queue uploads and store media locally when disconnected.

### 2.2 AI Assistant
- **Conversational Chat**: Users can chat with a TigoAI assistant.
- **Voice Interaction**: Integration with voice input (simulated) for hands-free queries.
- **Visual Intelligence**: Analyzes captured photos using Supabase Edge Functions (integrated with an external AI API).
- **History**: Maintains chat history with Supabase backend.

### 2.3 Device Management
- **Status Monitoring**: Shows battery level, connection status, and last sync time.
- **Settings**: Toggle voice activation, photo resolution, and video quality.
- **Media Sync**: Explicitly trigger media downloads from the glasses.

## 3. Communication & Data Flow

### 3.1 Backend (Supabase)
- **Authentication**: Managed via `supabase.auth`.
- **Database**: Stores media metadata, albums, and chat messages.
- **Edge Functions**:
  - `ai-chat`: Handles LLM interactions and history management.
  - `analyze-media`: Performs image-to-text analysis using AI.
- **Storage**: Supabase Buckets are used for hosting images and videos.

### 3.2 Services Architecture
- `backendService.ts`: Central point for all Supabase interactions.
- `glassesService.ts`: Simulates hardware interactions (Capture, Sync, Settings).
- `offlineService.ts`: Manages the synchronization queue and local persistence.
- `aiService.ts`: Mock AI logic for development.

## 4. Key Components & Hooks

### 4.1 Hooks
- `useAI`: Manages chat state, message sending, and voice processing.
- `useGlasses`: Primary hook for device status and media actions.
- `useAuth`: Wraps Supabase auth state.

### 4.2 UI Components
- `CaptureButton`: Animated button for taking photos/videos (LinearGradient + MaterialIcons).
- `VoiceButton`: Pulsing animation during voice listening.
- `MediaGrid`: Performance-optimized grid for displaying assets.
- `AlbumList`: Horizontal scroll for album selection.

## 5. Navigation (Expo Router)
- **Tabs**: `Gallery`, `AI`, `Device`.
- **Modals**: Detailed media view for analysis and sharing.
- **Onboarding**: Multi-step flow for first-time users (saved in `AsyncStorage`).

## 6. Branding
- **Name**: TigoAI
- **Theme**: Dark-centric aesthetic (Black, Primary Blue, Secondary Violet).
- **Identity**: Futuristic "Intelligence Beyond Limits" concept.

## 7. Python Backend (Integration)
### 7.1 Multimodal Core
- **Model**: `meta-llama/llama-4-scout-17b-16e-instruct` via Groq for high-speed spatial vision.
- **Audio**: Whisper-large-v3 for command transcription.
- **Protocol**: HTTP endpoints (`/transcribe`, `/upload_media`) optimized for ESP32 constraints.

### 7.2 Realtime Sync
- **Supabase Realtime**: The Android app subscribes to `chat_messages` and `media_items` to reflect hardware actions instantly.
- **Multi-user Support**: Instrumented with `user_id` and `device_id` for scalable deployments.

## 8. New UI Features
- **Command History Panel**: A side-sliding panel accessibility from the AI tab to track past interactions.
- **Animated Onboarding**: Rebranded TigoAI experience with smooth transitions.
