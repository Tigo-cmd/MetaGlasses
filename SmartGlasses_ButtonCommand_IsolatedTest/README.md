# Smart Glasses Isolated Button Command Test

This test uses only the physical button for commands. It does not use OpenAI or an API key.

## Gestures

```text
Hold button for 2 seconds and keep holding:
- C3 plays a short local tone
- C3 starts listening through the INMP441 mic
- C3 streams audio chunks to backend
```

```text
Release after recording:
- backend stops receiving audio
- backend saves RAW and WAV files
```

```text
Double press:
- C3 asks backend for the last recording
- backend streams the last recording back as PCM
- C3 plays it through the MAX98357A amp
```

```text
Triple press:
- C3 tells backend to request camera snapshots
- ESP32-CAM polls backend
- ESP32-CAM captures two JPEG frames
- backend saves both JPG files and one MJPEG file
```

## Files

```text
SmartGlasses_ButtonCommand_IsolatedTest
├─ C3ButtonCommandNode
│  └─ C3ButtonCommandNode.ino
├─ ESP32CamSnapshotNode
│  └─ ESP32CamSnapshotNode.ino
├─ backend
│  ├─ button_command_backend.py
│  └─ requirements.txt
└─ README.md
```

## Pins

### ESP32-C3

```text
Button      -> GPIO 10
Mic BCLK    -> GPIO 4
Mic WS      -> GPIO 5
Mic SD      -> GPIO 6
Amp BCLK    -> GPIO 4
Amp LRC/WS  -> GPIO 5
Amp DIN     -> GPIO 7
```

### ESP32-CAM AI Thinker

```text
PWDN  -> GPIO 32
RESET -> -1
XCLK  -> GPIO 0
SIOD  -> GPIO 26
SIOC  -> GPIO 27
Y9    -> GPIO 35
Y8    -> GPIO 34
Y7    -> GPIO 39
Y6    -> GPIO 36
Y5    -> GPIO 21
Y4    -> GPIO 19
Y3    -> GPIO 18
Y2    -> GPIO 5
VSYNC -> GPIO 25
HREF  -> GPIO 23
PCLK  -> GPIO 22
```

## Network Settings

Both sketches currently use:

```cpp
const char* ssid = "CES";
const char* password = "CES@24700";
const char* serverBaseUrl = "http://192.168.18.3:5000";
```

The ESP32-CAM sketch uses:

```cpp
const char* backendBaseUrl = "http://192.168.18.3:5000";
```

Change the IP if your backend PC IP changes.

## Run Backend

```powershell
cd "F:\Users\Dan\Desktop\CES\Project Backups\Smart Glasses\SmartGlasses_ButtonCommand_IsolatedTest\backend"
python -m pip install -r requirements.txt
python button_command_backend.py
```

Debug URLs:

```text
http://192.168.18.3:5000/health
http://192.168.18.3:5000/last_snapshot_status
```

## Upload C3 Sketch

Open:

```text
F:\Users\Dan\Desktop\CES\Project Backups\Smart Glasses\SmartGlasses_ButtonCommand_IsolatedTest\C3ButtonCommandNode\C3ButtonCommandNode.ino
```

Suggested Arduino settings:

```text
Board: ESP32C3 Dev Module or ESP32-C3 Super Mini equivalent
USB CDC On Boot: Enabled if your board needs it
Upload Speed: 115200 or 460800
Serial Monitor: 115200 baud
```

## Upload ESP32-CAM Sketch

Open:

```text
F:\Users\Dan\Desktop\CES\Project Backups\Smart Glasses\SmartGlasses_ButtonCommand_IsolatedTest\ESP32CamSnapshotNode\ESP32CamSnapshotNode.ino
```

Suggested Arduino settings:

```text
Board: AI Thinker ESP32-CAM
Partition Scheme: Huge APP
PSRAM: Enabled
Core Debug Level: None
Upload Speed: 115200
Serial Monitor: 115200 baud
```

## Expected Test Order

1. Start backend.
2. Upload and power ESP32-CAM. Confirm it says `Camera init OK`.
3. Upload and power ESP32-C3. Confirm it says the button command test is ready.
4. Hold button for 2 seconds until you hear the tone.
5. Speak while still holding.
6. Release. Backend should save WAV.
7. Double press. Speaker should replay last recording.
8. Triple press. Backend should save two JPG frames and one `.mjpeg` file in `backend\snapshots`.

## Note About MPEG

This test saves the two camera snapshots as JPEG files and also creates an MJPEG stream file with extension `.mjpeg`. MJPEG is the simple camera-friendly form of Motion JPEG video and avoids adding heavy video dependencies like FFmpeg.
