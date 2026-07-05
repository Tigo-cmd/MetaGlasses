#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>

// ============================================================
// TigoAI Smart Glasses Firmware - ESP32-CAM Vision Node
//
// Polls the backend for "snapshot2" command, captures two JPEG
// frames, uploads them, and notifies the backend when completed.
// ============================================================

// ===================== WIFI & BACKEND =====================
const char* ssid = "CLICKNETWORKS";
const char* password = "hotguy112345";
const char* backendBaseUrl = "http://192.168.1.154:5000"; // Python backend URL

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
  Serial.println("=== TIGOAI GLASSES - ESP32-CAM NODE READY ===");

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
    config.frame_size = FRAMESIZE_VGA;   // 640x480 for clearer vision analysis
    config.jpeg_quality = 8;             // Lower number = higher quality (range 0-63)
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
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

  // Tune the sensor for better image quality
  sensor_t* s = esp_camera_sensor_get();
  s->set_framesize(s, FRAMESIZE_VGA);    // 640x480
  s->set_quality(s, 8);                  // JPEG compression quality
  s->set_brightness(s, 1);               // Slightly brighter
  s->set_saturation(s, 1);               // Slightly more vivid colours
  s->set_sharpness(s, 1);                // Sharpen edges
  s->set_whitebal(s, 1);                 // Enable auto white balance
  s->set_awb_gain(s, 1);                 // Enable AWB gain
  s->set_exposure_ctrl(s, 1);            // Enable auto exposure
  s->set_aec2(s, 1);                     // Enable AEC DSP
  s->set_gain_ctrl(s, 1);                // Enable auto gain

  // Discard initial frames so auto-exposure stabilises
  for (int i = 0; i < 4; i++) {
    camera_fb_t* fb = esp_camera_fb_get();
    if (fb) esp_camera_fb_return(fb);
    delay(100);
  }
  Serial.println("Camera sensor stabilised.");
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
      notifyBackendDone(sessionId, "snapshot_done");
    } else if (command.startsWith("video|")) {
      Serial.print("Command: ");
      Serial.println(command);
      String sessionId = command.substring(String("video|").length());
      captureVideo(sessionId);
      notifyBackendDone(sessionId, "video_done");
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

  // Discard 3 warm-up frames so auto-exposure/white-balance settle
  for (int w = 0; w < 3; w++) {
    camera_fb_t* warmup = esp_camera_fb_get();
    if (warmup) esp_camera_fb_return(warmup);
    delay(80);
  }
  Serial.println("Warm-up frames discarded, capturing now...");

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

void captureVideo(String sessionId) {
  Serial.print("Capturing 15 video frames for session: ");
  Serial.println(sessionId);

  for (int frameId = 0; frameId < 15; frameId++) {
    camera_fb_t* fb = esp_camera_fb_get();

    if (!fb) {
      Serial.println("Video camera capture failed");
      delay(100);
      continue;
    }

    Serial.print("Captured video frame ");
    Serial.print(frameId);
    Serial.print(" | Size: ");
    Serial.println(fb->len);

    bool ok = uploadFrame(fb->buf, fb->len, frameId, sessionId);
    Serial.println(ok ? "Frame upload OK" : "Frame upload FAILED");

    esp_camera_fb_return(fb);
    delay(50); // Delay between frames to aim for ~5-8 FPS (including upload overhead)
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

void notifyBackendDone(String sessionId, String type) {
  if (!ensureWiFi()) {
    return;
  }

  HTTPClient http;
  String url = String(backendBaseUrl) + "/cam_done";
  String body = type + "|" + sessionId;

  http.begin(url);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "text/plain");

  int response = http.POST((uint8_t*)body.c_str(), body.length());

  Serial.print("cam_done response: ");
  Serial.println(response);

  http.end();
}
