# TigoAI Smart Glasses Firmware (ESP32)

This directory contains the firmware for the hardware portion of the TigoAI ecosystem. The code is designed to run on an **ESP32-CAM** or a standard ESP32 with an I2S stack.

## 🚀 Features
- **WiFi Connectivity**: Connects to your local network to talk to the TigoAI backend.
- **Visual Capture**: Uses the `esp_camera` driver to take photos and send them for AI analysis.
- **Voice Commands**: Records audio and sends it to the Whisper-powered transcription endpoint.
- **Audio Feedback**: Receives the `audio_url` from the AI and streams the high-quality **PlayAI-TTS** response back through the glasses' speaker.

## 🛠️ Hardware Requirements
- **Microcontroller**: ESP32-CAM (AI-Thinker) or ESP32-S3.
- **Camera**: OV2640 (standard on ESP32-CAM).
- **Speaker**: I2S DAC (e.g., MAX98357A) connected to a 4Ω speaker.
- **Microphone**: I2S MEMS Microphone (e.g., INMP441).

## 📚 Required Libraries (Arduino IDE)
1. **ArduinoJson**: For parsing AI responses.
2. **ESP32-audioI2S**: (Recommended) For smooth audio streaming and decoding of the `.wav` response files.
3. **HTTPClient**: Built-in ESP32 library.

## 🔧 Setup Instructions
1. Open `TigoAI_ESP32.ino` in the Arduino IDE.
2. Update the `ssid` and `password` with your WiFi credentials.
3. Update `serverUrl` with the IP address of your computer running the Python backend (e.g., `http://192.168.1.50:5000`).
4. Ensure your ESP32 board is set to `AI Thinker ESP32-CAM` in the board manager.
5. Flash the code!

## 🔄 The Interaction Loop
1. User triggers a command (e.g., button press).
2. ESP32 captures camera/audio data.
3. ESP32 sends a `POST` request to the backend.
4. Backend analyzes the data and generates a **PlayAI** voice response.
5. ESP32 receives the `audio_url`, fetches the file via `GET`, and plays it for the user.
