# TigoAI Smart Glasses Firmware (ESP32)

This directory contains the production firmware for the hardware portion of the TigoAI ecosystem.

## 🚀 System Architecture

Due to the limited GPIO availability on standard AI-Thinker ESP32-CAM boards (where camera data lines and PSRAM consume most pins), the production setup utilizes a **two-node architecture**:

1.  **ESP32-C3 Node (Audio & Controller)**: Runs `TigoAI_ESP32_C3.ino`. It handles the physical button commands, records speech via the INMP441 microphone, streams audio chunk-by-chunk to the backend, and plays the AI's audio response through the MAX98357A I2S amplifier and speaker.
2.  **ESP32-CAM Node (Vision)**: Runs `TigoAI_ESP32_CAM.ino`. It polls the backend in the background and captures/uploads JPEG frames when a snapshot command is received.

For larger microcontrollers (such as the ESP32-S3) with enough free GPIO lines, `TigoAI_ESP32.ino` acts as a unified reference template combining both systems.

---

## 🛠️ Hardware Requirements

*   **Microcontrollers**: 1x ESP32-C3 (Super Mini or Dev module) + 1x AI-Thinker ESP32-CAM.
*   **Camera**: OV2640 (standard on ESP32-CAM).
*   **Speaker/Amp**: MAX98357A I2S DAC connected to a 4Ω/8Ω speaker.
*   **Microphone**: INMP441 I2S MEMS microphone.
*   **Button**: A momentary tactile pushbutton.

---

## 📌 Pin Configurations

### A. ESP32-C3 (Audio/Control Node)
*   **Button**: GPIO 10
*   **INMP441 Microphone (I2S RX)**:
    *   BCLK (Serial Clock): GPIO 4
    *   WS/LRC (Word Select): GPIO 5
    *   SD (Serial Data Out): GPIO 6
*   **MAX98357A Amplifier (I2S TX)**:
    *   BCLK (Serial Clock): GPIO 4 *(Shared with microphone)*
    *   WS/LRC (Word Select): GPIO 5 *(Shared with microphone)*
    *   DIN (Serial Data In): GPIO 7

### B. ESP32-CAM (Vision Node)
*   Uses standard AI-Thinker camera pins (GPIOs 32, -1, 0, 26, 27, 35, 34, 39, 36, 21, 19, 18, 5, 25, 23, 22).

---

## 🔧 Setup & Flashing Instructions

1.  Open `TigoAI_ESP32_C3.ino` (for the C3 board) or `TigoAI_ESP32_CAM.ino` (for the CAM board) in the Arduino IDE.
2.  Update the `ssid` and `password` with your WiFi credentials in both sketches.
3.  Update the server URLs (`serverBaseUrl` or `backendBaseUrl`) with the IP address of your computer running the Python backend (e.g., `http://192.168.1.50:5000`).
4.  Configure Arduino IDE settings for each board:
    *   **ESP32-C3**: Board: `ESP32C3 Dev Module` or `ESP32-C3 Super Mini`. USB CDC On Boot: Enabled.
    *   **ESP32-CAM**: Board: `AI Thinker ESP32-CAM`. Partition Scheme: `Huge APP`. PSRAM: Enabled.
5.  Flash the respective sketches!

---

## 🔄 Button Gestures & Interaction Loop

1.  **Voice command (Hold button for 2s)**:
    *   The C3 plays a start tone (beep) and starts recording from the I2S mic.
    *   Audio is streamed chunk-by-chunk to the backend via `/chunk`.
    *   Upon button release, streaming stops. The backend transcribes the audio with Whisper, processes it with Llama (TigoAI), and generates the Orpheus TTS voice response.
2.  **Audio Playback (Double press)**:
    *   The C3 queries the backend for the AI response. Once ready, it streams the raw PCM response audio from `/last_recording_pcm` and plays it.
3.  **Camera Capture (Triple press)**:
    *   The C3 tells the backend to request a snapshot.
    *   The ESP32-CAM polls the backend, notices the snapshot command, captures two JPEG frames, and uploads them.
    *   The backend saves the frames, generates an MJPEG stream, uploads them to Supabase, and performs Llama Vision analysis. The photos instantly appear in the React Native mobile app's gallery!
