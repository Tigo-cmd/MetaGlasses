/**
 * TigoAI Smart Glasses Firmware - Legacy/Unified Template
 * 
 * NOTE: For the production two-node architecture, please use:
 *   - TigoAI_ESP32_C3.ino  (for the audio/control node)
 *   - TigoAI_ESP32_CAM.ino (for the vision node)
 * 
 * Target: ESP32-S3 or unified board with Camera & I2S Microphone/Speaker
 * Author: Antigravity AI
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_BACKEND_IP:5000"; // Python backend URL

// Device Identity
const char* userId = "user_123";
const char* deviceId = "tigo_glasses_v1";

// Pin definitions for ESP32-CAM (AI-Thinker)
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

void setup() {
  Serial.begin(115200);
  
  // 1. Initialize Camera
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
  
  if(psramFound()){
    config.frame_size = FRAMESIZE_UXGA;
    config.jpeg_quality = 10;
    config.fb_count = 2;
  } else {
    config.frame_size = FRAMESIZE_SVGA;
    config.jpeg_quality = 12;
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed with error 0x%x", err);
    return;
  }

  // 2. Connect WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());
}

/**
 * Capture and upload photo for AI analysis
 */
void captureAndAnalyze() {
  camera_fb_t * fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  HTTPClient http;
  String url = String(serverUrl) + "/upload_media";
  http.begin(url);
  
  // Prepare Multi-part form data
  String boundary = "----TigoBoundary";
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  
  // Create body
  String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"capture.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "\r\nContent-Disposition: form-data; name=\"user_id\"\r\n\r\n" + userId + "\r\n--" + boundary + "--\r\n";
  
  uint32_t totalLen = head.length() + fb->len + tail.length();
  
  Serial.println("Uploading image...");
  int httpResponseCode = http.sendRequest("POST", (uint8_t*)head.c_str(), head.length()); // This is simplified, real multipart needs stream chunks
  
  // Note: For real large JPEG, use http.sendRequest with a stream or custom builder
  // This is a minimal conceptual implementation for ESP32
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println(httpResponseCode);
    Serial.println(response);
    
    // Parse response for AI analysis result
    StaticJsonDocument<512> doc;
    deserializeJson(doc, response);
    const char* analysis = doc["analysis"];
    Serial.printf("AI Description: %s\n", analysis);
  } else {
    Serial.print("Error on uploading image: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
  esp_camera_fb_return(fb);
}

/**
 * Capture audio (conceptual) and send to transcribe
 */
void sendVoiceCommand() {
  // Concept: Record from I2S mic into buffer
  // For this template, we focus on the HTTP structure
  
  HTTPClient http;
  String url = String(serverUrl) + "/transcribe";
  http.begin(url);
  
  // Same multipart strategy as above
  // On success, we get assistant URL:
  // "ai_response": { "audio_url": "/api/tts/..." }
  
  int httpResponseCode = http.POST("POST_BUFF_DATA"); 
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    StaticJsonDocument<512> doc;
    deserializeJson(doc, response);
    const char* audioUrlPath = doc["ai_response"]["audio_url"];
    
    if (audioUrlPath) {
      playResponse(audioUrlPath);
    }
  }
  http.end();
}

/**
 * Fetch and play the AI response audio
 */
void playResponse(String path) {
  HTTPClient http;
  String fullUrl = String(serverUrl) + path;
  http.begin(fullUrl);
  
  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    // Stream audio to I2S speaker
    WiFiClient * stream = http.getStreamPtr();
    // Use an audio library like ESP32-audioI2S to feed the stream to speaker
    Serial.println("Streaming AI response to speaker...");
  }
  http.end();
}

void loop() {
  // Example triggers
  // if (digitalRead(PHOTO_BTN) == LOW) captureAndAnalyze();
  // if (digitalRead(VOICE_BTN) == LOW) sendVoiceCommand();
  delay(10);
}
