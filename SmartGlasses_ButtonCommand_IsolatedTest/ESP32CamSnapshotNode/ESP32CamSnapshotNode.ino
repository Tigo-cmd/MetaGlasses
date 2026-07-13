#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ============================================================
// Smart Glasses Isolated Button Command Test - ESP32-CAM
//
// Polls backend for "snapshot2" command, captures two JPEG
// frames, uploads both, then notifies backend.
// ============================================================

// ===================== WIFI =====================
const char* ssid = "CES";
const char* password = "CES@2470";
const char* backendBaseUrl = "http://192.168.18.6:5000";

// ===================== CAMERA MODEL: AI THINKER =====================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27

#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

unsigned long lastPollTime = 0;
const unsigned long pollInterval = 500;

// ===================== SETUP =====================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=== SMART GLASSES SNAPSHOT TEST - ESP32-CAM ===");

  connectWiFi();
  setupCamera();

  Serial.println("Polling backend for snapshot commands.");
}

// ===================== LOOP =====================
void loop() {
  if (millis() - lastPollTime >= pollInterval) {
    lastPollTime = millis();
    pollBackendCommand();
  }
}

// ===================== WIFI =====================
void connectWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected!");
  Serial.print("ESP32-CAM IP: ");
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

// ===================== CAMERA SETUP =====================
void setupCamera() {
  camera_config_t config;

  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;

  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;

  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QQVGA;
    config.jpeg_quality = 15;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);

  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    while (true) {
      delay(1000);
    }
  }

  Serial.println("Camera init OK");

  sensor_t* s = esp_camera_sensor_get();
  s->set_framesize(s, FRAMESIZE_QVGA);
}

// ===================== COMMAND POLLING =====================
void pollBackendCommand() {
  if (!ensureWiFi()) {
    return;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/cam_command";

  http.begin(url);
  http.setTimeout(10000);
  int code = http.GET();

  if (code == 200) {
    String command = http.getString();
    command.trim();
    http.end();

    if (command.startsWith("snapshot2|")) {
      Serial.print("Command: ");
      Serial.println(command);
      String sessionId = command.substring(String("snapshot2|").length());
      captureTwoSnapshots(sessionId);
      notifyBackendDone(sessionId);
    }
    return;
  }

  Serial.print("Command poll failed. HTTP: ");
  Serial.println(code);
  http.end();
}

// ===================== CAPTURE / UPLOAD =====================
void captureTwoSnapshots(String sessionId) {
  Serial.print("Capturing 2 snapshots for session: ");
  Serial.println(sessionId);

  for (int frameId = 0; frameId < 2; frameId++) {
    camera_fb_t* fb = esp_camera_fb_get();

    if (!fb) {
      Serial.println("Camera capture failed");
      delay(300);
      continue;
    }

    Serial.print("Captured frame ");
    Serial.print(frameId);
    Serial.print(" | Size: ");
    Serial.println(fb->len);

    bool ok = uploadFrame(fb->buf, fb->len, frameId, sessionId);
    Serial.println(ok ? "Frame upload OK" : "Frame upload FAILED");

    esp_camera_fb_return(fb);
    delay(300);
  }
}

bool uploadFrame(uint8_t* data, size_t len, int frameId, String sessionId) {
  if (!ensureWiFi()) {
    return false;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/cam_frame";

  http.begin(url);
  http.setTimeout(20000);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Frame-ID", String(frameId));
  http.addHeader("X-Session-ID", sessionId);

  int response = http.POST(data, len);

  Serial.print("Backend frame response: ");
  Serial.println(response);

  http.end();
  return response == 200;
}

void notifyBackendDone(String sessionId) {
  if (!ensureWiFi()) {
    return;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/cam_done";
  String body = String("snapshot_done|") + sessionId;

  http.begin(url);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "text/plain");

  int response = http.POST((uint8_t*)body.c_str(), body.length());

  Serial.print("cam_done response: ");
  Serial.println(response);

  http.end();
}
