#include <WiFi.h>
#include <HTTPClient.h>
#include <driver/i2s.h>
#include <math.h>

// ============================================================
// TigoAI Smart Glasses Firmware - ESP32-C3 Audio/Control Node
//
// Gestures:
//   Hold 2s and keep holding -> Beep, start mic streaming to backend
//   Release after recording  -> Stop mic, backend transcribes & runs AI
//   Double press             -> Playback last AI voice response
//   Triple press             -> Ask backend to request camera snapshot
// ============================================================

// ===================== WIFI & BACKEND =====================
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";
const char* serverBaseUrl = "http://192.168.1.154:5000"; // Python backend URL

// ===================== PINS =====================
#define BUTTON_PIN 10

#define MIC_I2S_BCLK 4
#define MIC_I2S_WS   5
#define MIC_I2S_SD   6

#define AMP_I2S_BCLK 4
#define AMP_I2S_WS   5
#define AMP_I2S_DIN  7

// ===================== AUDIO SETTINGS =====================
#define I2S_PORT I2S_NUM_0
#define SAMPLE_RATE 16000
#define MIC_BUFFER_LEN 1024
#define PLAY_BUFFER_SAMPLES 512

int32_t micRawBuffer[MIC_BUFFER_LEN];
int16_t micPcmBuffer[MIC_BUFFER_LEN];
int16_t playMonoBuffer[PLAY_BUFFER_SAMPLES];
int16_t playStereoBuffer[PLAY_BUFFER_SAMPLES * 2];

enum I2SMode {
  I2S_MODE_NONE,
  I2S_MODE_MIC,
  I2S_MODE_AMP
};

I2SMode currentI2SMode = I2S_MODE_NONE;

void stopI2S();
void setupI2SAmp();
void setupI2SMic();
void writeSilence(int ms);

// ===================== BUTTON STATE =====================
const unsigned long longPressMs = 500;
const unsigned long multiTapWindowMs = 450;
const unsigned long debounceMs = 35;

bool lastRawButton = false;
bool stableButton = false;
bool previousStableButton = false;
unsigned long lastDebounceTime = 0;
unsigned long pressStartTime = 0;
unsigned long lastReleaseTime = 0;
int tapCount = 0;
bool recording = false;
bool longPressTriggered = false;

unsigned long lastC3PollTime = 0;
const unsigned long c3PollInterval = 500; // Poll every 500ms when idle

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(BUTTON_PIN, INPUT_PULLUP);

  connectWiFi();
  playBootTone();
  setupI2SMic();

  Serial.println();
  Serial.println("=== TIGOAI GLASSES - C3 NODE READY ===");
  Serial.println("Hold 2s to record. Double tap to play response. Triple tap to take photo.");
}

// ===================== LOOP =====================
void loop() {
  updateButtonState();

  if (recording) {
    streamAudioChunk();
  } else if (currentI2SMode != I2S_MODE_AMP) {
    if (millis() - lastC3PollTime >= c3PollInterval) {
      lastC3PollTime = millis();
      pollC3Command();
    }
  }

  if (!stableButton && tapCount > 0 && millis() - lastReleaseTime > multiTapWindowMs) {
    handleTapGesture(tapCount);
    tapCount = 0;
  }
}

// ===================== BUTTON HANDLING =====================
void updateButtonState() {
  bool rawButton = digitalRead(BUTTON_PIN) == LOW;

  if (rawButton != lastRawButton) {
    lastDebounceTime = millis();
    lastRawButton = rawButton;
  }

  if (millis() - lastDebounceTime < debounceMs) {
    return;
  }

  previousStableButton = stableButton;
  stableButton = rawButton;

  if (stableButton && !previousStableButton) {
    pressStartTime = millis();
    longPressTriggered = false;
  }

  if (stableButton && !longPressTriggered && millis() - pressStartTime >= longPressMs) {
    longPressTriggered = true;
    tapCount = 0;
    startRecording();
  }

  if (!stableButton && previousStableButton) {
    if (recording) {
      stopRecording();
    } else if (!longPressTriggered) {
      tapCount++;
      lastReleaseTime = millis();
    }
  }
}

void handleTapGesture(int count) {
  Serial.print("Tap gesture count: ");
  Serial.println(count);

  if (count == 2) {
    requestPlayback();
    return;
  }

  if (count == 3) {
    requestCameraSnapshots();
    return;
  }

  if (count == 4) {
    requestVideo();
    return;
  }

  Serial.println("Single tap ignored.");
}

// ===================== GESTURE ACTIONS =====================
void startRecording() {
  Serial.println("\n>>> LONG PRESS: START RECORDING <<<");
  playStartTone();
  setupI2SMic();

  if (sendCommand("/start")) {
    recording = true;
    Serial.println("Streaming mic to backend...");
  } else {
    Serial.println("Could not start backend recording.");
  }
}

void stopRecording() {
  recording = false;
  Serial.println(">>> RELEASE: STOP RECORDING <<<");
  sendCommand("/stop");
  setupI2SMic();
}

void requestPlayback() {
  Serial.println("\n>>> DOUBLE TAP: PLAY BACKEND RESPONSE <<<");

  if (waitForEndpointOk("/prepare_playback", 10000)) {
    playBackendPcm("/last_recording_pcm");
  } else {
    Serial.println("Backend has no AI response audio ready.");
  }

  setupI2SMic();
}

void requestCameraSnapshots() {
  Serial.println("\n>>> TRIPLE TAP: TAKE CAMERA SNAPSHOT <<<");
  bool ok = sendCommand("/snapshot2");
  Serial.println(ok ? "Snapshot command sent to backend." : "Snapshot command failed.");
}

void requestVideo() {
  Serial.println("\n>>> 4-TAP: REQUEST VIDEO CAPTURE <<<");
  bool ok = sendCommand("/video");
  Serial.println(ok ? "Video command sent to backend." : "Video command failed.");
}

// ===================== WIFI =====================
void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nConnected!");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

bool ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return true;
  }

  Serial.println("WiFi disconnected. Reconnecting...");
  WiFi.disconnect();
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  return WiFi.status() == WL_CONNECTED;
}

// ===================== I2S MODE SWITCHING =====================
void stopI2S() {
  if (currentI2SMode != I2S_MODE_NONE) {
    i2s_stop(I2S_PORT);
    i2s_driver_uninstall(I2S_PORT);
    currentI2SMode = I2S_MODE_NONE;
    delay(20);
  }
}

void setupI2SMic() {
  if (currentI2SMode == I2S_MODE_MIC) {
    return;
  }

  stopI2S();

  i2s_config_t config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_RX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_32BIT,
    .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_MSB,
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = false,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pins = {
    .bck_io_num = MIC_I2S_BCLK,
    .ws_io_num = MIC_I2S_WS,
    .data_out_num = I2S_PIN_NO_CHANGE,
    .data_in_num = MIC_I2S_SD
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("Mic i2s_driver_install failed: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pins);
  if (err != ESP_OK) {
    Serial.printf("Mic i2s_set_pin failed: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  currentI2SMode = I2S_MODE_MIC;
  Serial.println("I2S mic mode ready");
}

void setupI2SAmp() {
  if (currentI2SMode == I2S_MODE_AMP) {
    return;
  }

  stopI2S();

  i2s_config_t config = {
    .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
    .sample_rate = SAMPLE_RATE,
    .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
    .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
    .communication_format = I2S_COMM_FORMAT_STAND_I2S,
    .intr_alloc_flags = 0,
    .dma_buf_count = 8,
    .dma_buf_len = 512,
    .use_apll = false,
    .tx_desc_auto_clear = true,
    .fixed_mclk = 0
  };

  i2s_pin_config_t pins = {
    .bck_io_num = AMP_I2S_BCLK,
    .ws_io_num = AMP_I2S_WS,
    .data_out_num = AMP_I2S_DIN,
    .data_in_num = I2S_PIN_NO_CHANGE
  };

  esp_err_t err = i2s_driver_install(I2S_PORT, &config, 0, NULL);
  if (err != ESP_OK) {
    Serial.printf("Amp i2s_driver_install failed: %d\n", err);
    return;
  }

  err = i2s_set_pin(I2S_PORT, &pins);
  if (err != ESP_OK) {
    Serial.printf("Amp i2s_set_pin failed: %d\n", err);
    return;
  }

  i2s_zero_dma_buffer(I2S_PORT);
  currentI2SMode = I2S_MODE_AMP;
  Serial.println("I2S amp mode ready");
  writeSilence(60); // Warm up I2S amplifier chip
}

// ===================== MIC STREAMING =====================
void streamAudioChunk() {
  setupI2SMic();

  size_t bytesRead = 0;
  esp_err_t err = i2s_read(I2S_PORT, micRawBuffer, sizeof(micRawBuffer), &bytesRead, portMAX_DELAY);

  if (err != ESP_OK || bytesRead == 0) {
    Serial.printf("i2s_read failed: %d\n", err);
    return;
  }

  int samplesRead = bytesRead / sizeof(int32_t);

  for (int i = 0; i < samplesRead; i++) {
    int32_t sample = micRawBuffer[i] >> 8;

    if (sample & 0x00800000) {
      sample |= 0xFF000000;
    }

    int16_t pcm16 = sample >> 8;

    if (pcm16 > 16384) {
      pcm16 -= 32768;
    }

    micPcmBuffer[i] = pcm16;
  }

  sendChunk((uint8_t*)micPcmBuffer, samplesRead * sizeof(int16_t));
}

// ===================== HTTP HELPERS =====================
bool sendCommand(const char* endpoint) {
  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = String(serverBaseUrl) + endpoint;

  http.begin(url);
  http.setTimeout(15000);
  int response = http.POST("");

  Serial.print(endpoint);
  Serial.print(" response: ");
  Serial.println(response);

  http.end();
  return response == 200;
}

bool sendChunk(uint8_t* data, int sizeBytes) {
  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = String(serverBaseUrl) + "/chunk";

  http.begin(url);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "application/octet-stream");

  int response = http.POST(data, sizeBytes);

  Serial.print("Chunk sent, response: ");
  Serial.println(response);

  http.end();
  return response == 200;
}

bool waitForEndpointOk(const char* endpoint, unsigned long timeoutMs) {
  unsigned long start = millis();

  while (millis() - start < timeoutMs) {
    if (!ensureWiFi()) {
      delay(500);
      continue;
    }

    HTTPClient http;
    String url = String(serverBaseUrl) + endpoint;
    http.begin(url);
    http.setTimeout(5000);
    int response = http.POST("");
    http.end();

    if (response == 200) {
      return true;
    }

    delay(500);
  }

  return false;
}

// ===================== AMP PLAYBACK =====================
void playTone(float freq, int durationMs, float volume) {
  setupI2SAmp();

  int totalSamples = SAMPLE_RATE * durationMs / 1000;
  int generated = 0;
  while (generated < totalSamples) {
    int count = PLAY_BUFFER_SAMPLES;
    if (generated + count > totalSamples) {
      count = totalSamples - generated;
    }

    for (int i = 0; i < count; i++) {
      float t = (float)(generated + i) / SAMPLE_RATE;
      int16_t sample = (int16_t)(sin(2.0 * PI * freq * t) * 32767.0 * volume);
      playStereoBuffer[i * 2] = sample;
      playStereoBuffer[(i * 2) + 1] = sample;
    }

    size_t bytesWritten = 0;
    i2s_write(I2S_PORT, playStereoBuffer, count * 2 * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
    generated += count;
  }
}

void playStartTone() {
  playTone(880.0, 180, 0.45);
  writeSilence(80);
}

void playBootTone() {
  playTone(523.25, 120, 0.40); // C5
  writeSilence(20);
  playTone(659.25, 120, 0.40); // E5
  writeSilence(20);
  playTone(783.99, 180, 0.40); // G5
  writeSilence(100);
}

void playBackendPcm(const char* endpoint) {
  if (!ensureWiFi()) {
    return;
  }

  setupI2SAmp();

  HTTPClient http;
  String url = String(serverBaseUrl) + endpoint;

  Serial.println("Downloading playback PCM...");
  http.begin(url);
  http.setTimeout(20000);

  int httpCode = http.GET();
  if (httpCode != 200) {
    Serial.print("Playback download failed. HTTP: ");
    Serial.println(httpCode);
    http.end();
    return;
  }

  WiFiClient* stream = http.getStreamPtr();
  int totalSize = http.getSize();
  int totalRead = 0;

  Serial.print("Playback bytes: ");
  Serial.println(totalSize);

  while (http.connected() && (totalSize < 0 || totalRead < totalSize)) {
    int wanted = sizeof(playMonoBuffer);

    if (totalSize > 0 && totalRead + wanted > totalSize) {
      wanted = totalSize - totalRead;
    }

    int availableBytes = stream->available();
    if (availableBytes <= 0) {
      delay(1);
      continue;
    }

    int bytesToRead = availableBytes;
    if (bytesToRead > wanted) {
      bytesToRead = wanted;
    }

    bytesToRead -= bytesToRead % 2;
    if (bytesToRead <= 0) {
      continue;
    }

    int bytesRead = stream->readBytes((uint8_t*)playMonoBuffer, bytesToRead);
    if (bytesRead <= 0) {
      break;
    }

    int monoSamples = bytesRead / sizeof(int16_t);
    for (int i = 0; i < monoSamples; i++) {
      int16_t sample = playMonoBuffer[i];
      playStereoBuffer[i * 2] = sample;
      playStereoBuffer[(i * 2) + 1] = sample;
    }

    size_t bytesWritten = 0;
    i2s_write(I2S_PORT, playStereoBuffer, monoSamples * 2 * sizeof(int16_t), &bytesWritten, portMAX_DELAY);

    totalRead += bytesRead;
  }

  http.end();
  writeSilence(250);
  Serial.println("Playback done.");
}

void writeSilence(int ms) {
  memset(playStereoBuffer, 0, sizeof(playStereoBuffer));

  int loops = (SAMPLE_RATE * ms / 1000) / PLAY_BUFFER_SAMPLES;
  for (int i = 0; i < loops; i++) {
    size_t bytesWritten = 0;
    i2s_write(I2S_PORT, playStereoBuffer, sizeof(playStereoBuffer), &bytesWritten, portMAX_DELAY);
  }
}

int getBatteryLevel() {
  return 88; // Placeholder simulated battery percentage
}

float getUsedStorage() {
  float total = (float)ESP.getFlashChipSize() / (1024.0 * 1024.0);
  float freeH = (float)ESP.getFreeHeap() / (1024.0 * 1024.0);
  float used = total - freeH;
  return used > 0.0 ? used : 0.0;
}

float getTotalStorage() {
  return (float)ESP.getFlashChipSize() / (1024.0 * 1024.0);
}

void pollC3Command() {
  if (!ensureWiFi()) {
    return;
  }

  HTTPClient http;
  int battery = getBatteryLevel();
  float usedStorage = getUsedStorage();
  float totalStorage = getTotalStorage();

  String url = String(serverBaseUrl) + "/c3_command" +
               "?device_id=esp32_01" +
               "&battery=" + String(battery) +
               "&storage_used=" + String(usedStorage, 2) +
               "&storage_total=" + String(totalStorage, 2) +
               "&model=TIGOAI+SmartGlasses";

  http.begin(url);
  http.setTimeout(4000);
  int code = http.GET();

  if (code == 200) {
    String command = http.getString();
    command.trim();
    http.end();

    if (command == "play_response") {
      Serial.println("Received speak command from backend!");
      playBackendPcm("/last_recording_pcm");
      setupI2SMic(); // Re-enable mic after playing
    }
    return;
  }

  http.end();
}
