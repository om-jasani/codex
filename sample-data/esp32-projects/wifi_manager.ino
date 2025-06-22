/*
 * ESP32 WiFi Manager with Web Interface
 * Provides WiFi configuration and device management via web portal
 * 
 * Features:
 * - Auto-connect to saved WiFi networks
 * - Captive portal for WiFi configuration
 * - REST API for device control
 * - OTA (Over-The-Air) firmware updates
 * - Real-time sensor data streaming
 * 
 * Author: ESP32 Development Team
 * Date: 2024-02-01
 * Version: 3.0.0
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <Update.h>
#include <SPIFFS.h>
#include <AsyncWebSocket.h>

// Pin definitions
#define LED_STATUS_PIN 2
#define RESET_BUTTON_PIN 0
#define SENSOR_POWER_PIN 4

// Network configuration
const char* AP_SSID = "ESP32-Config";
const char* AP_PASSWORD = "configure123";
const IPAddress AP_IP(192, 168, 4, 1);
const IPAddress AP_GATEWAY(192, 168, 4, 1);
const IPAddress AP_SUBNET(255, 255, 255, 0);

// Web server and DNS
WebServer server(80);
AsyncWebSocket ws("/ws");
DNSServer dnsServer;
Preferences preferences;

// Device state
struct DeviceConfig {
  String ssid;
  String password;
  String deviceName;
  String apiKey;
  bool otaEnabled;
  int sensorInterval;
  String serverURL;
};

DeviceConfig config;
bool isConnected = false;
bool isConfigMode = false;
unsigned long lastSensorReading = 0;
unsigned long lastHeartbeat = 0;

// HTML templates
const char* configPageHTML = R"(
<!DOCTYPE html>
<html>
<head>
    <title>ESP32 WiFi Configuration</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f0f0f0; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        input, select { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 5px; }
        button { background: #007bff; color: white; padding: 12px 20px; border: none; border-radius: 5px; cursor: pointer; width: 100%; }
        button:hover { background: #0056b3; }
        .network { padding: 10px; margin: 5px 0; background: #f8f9fa; border-radius: 5px; cursor: pointer; }
        .network:hover { background: #e9ecef; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>ESP32 Device Configuration</h1>
        <div id="status"></div>
        
        <h3>Available Networks</h3>
        <div id="networks">Scanning...</div>
        
        <h3>WiFi Configuration</h3>
        <form id="configForm">
            <input type="text" id="ssid" placeholder="WiFi Network Name" required>
            <input type="password" id="password" placeholder="WiFi Password">
            <input type="text" id="deviceName" placeholder="Device Name" value="ESP32-Device">
            <input type="text" id="apiKey" placeholder="API Key (optional)">
            <input type="url" id="serverURL" placeholder="Server URL (optional)">
            <label><input type="checkbox" id="otaEnabled" checked> Enable OTA Updates</label>
            <input type="number" id="sensorInterval" placeholder="Sensor Interval (seconds)" value="30" min="5" max="3600">
            <button type="submit">Save Configuration</button>
        </form>
        
        <button onclick="resetDevice()">Factory Reset</button>
    </div>
    
    <script>
        document.getElementById('configForm').addEventListener('submit', saveConfig);
        loadNetworks();
        
        function loadNetworks() {
            fetch('/scan')
                .then(response => response.json())
                .then(data => {
                    const networksDiv = document.getElementById('networks');
                    networksDiv.innerHTML = '';
                    data.networks.forEach(network => {
                        const div = document.createElement('div');
                        div.className = 'network';
                        div.innerHTML = `<strong>${network.ssid}</strong> (${network.rssi} dBm) ${network.encryption}`;
                        div.onclick = () => document.getElementById('ssid').value = network.ssid;
                        networksDiv.appendChild(div);
                    });
                })
                .catch(err => {
                    document.getElementById('networks').innerHTML = 'Failed to load networks';
                });
        }
        
        function saveConfig(e) {
            e.preventDefault();
            const formData = new FormData(e.target);
            const config = {
                ssid: document.getElementById('ssid').value,
                password: document.getElementById('password').value,
                deviceName: document.getElementById('deviceName').value,
                apiKey: document.getElementById('apiKey').value,
                serverURL: document.getElementById('serverURL').value,
                otaEnabled: document.getElementById('otaEnabled').checked,
                sensorInterval: parseInt(document.getElementById('sensorInterval').value)
            };
            
            fetch('/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            })
            .then(response => response.json())
            .then(data => {
                const status = document.getElementById('status');
                if (data.success) {
                    status.innerHTML = '<div class="status success">Configuration saved! Device will restart...</div>';
                    setTimeout(() => location.reload(), 3000);
                } else {
                    status.innerHTML = '<div class="status error">Error: ' + data.message + '</div>';
                }
            });
        }
        
        function resetDevice() {
            if (confirm('This will reset all settings. Are you sure?')) {
                fetch('/reset', { method: 'POST' })
                    .then(() => {
                        alert('Device reset complete. It will restart now.');
                        location.reload();
                    });
            }
        }
    </script>
</body>
</html>
)";

void setup() {
  Serial.begin(115200);
  Serial.println("ESP32 WiFi Manager Starting...");
  
  // Initialize pins
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(RESET_BUTTON_PIN, INPUT_PULLUP);
  pinMode(SENSOR_POWER_PIN, OUTPUT);
  
  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS initialization failed");
  }
  
  // Initialize preferences
  preferences.begin("wifi-config", false);
  
  // Load configuration
  loadConfiguration();
  
  // Check for factory reset
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    delay(3000); // Hold for 3 seconds
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
      factoryReset();
    }
  }
  
  // Try to connect to WiFi
  if (config.ssid.length() > 0) {
    connectToWiFi();
  }
  
  // If not connected, start configuration mode
  if (!isConnected) {
    startConfigurationMode();
  } else {
    startNormalOperation();
  }
}

void loop() {
  if (isConfigMode) {
    dnsServer.processNextRequest();
    server.handleClient();
  } else {
    // Normal operation mode
    handleNormalOperation();
  }
  
  // Handle button press for reset
  if (digitalRead(RESET_BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(RESET_BUTTON_PIN) == LOW) {
      unsigned long pressStart = millis();
      while (digitalRead(RESET_BUTTON_PIN) == LOW && millis() - pressStart < 5000) {
        delay(100);
      }
      if (millis() - pressStart >= 5000) {
        factoryReset();
      }
    }
  }
  
  delay(100);
}

void loadConfiguration() {
  config.ssid = preferences.getString("ssid", "");
  config.password = preferences.getString("password", "");
  config.deviceName = preferences.getString("deviceName", "ESP32-Device");
  config.apiKey = preferences.getString("apiKey", "");
  config.otaEnabled = preferences.getBool("otaEnabled", true);
  config.sensorInterval = preferences.getInt("sensorInterval", 30);
  config.serverURL = preferences.getString("serverURL", "");
  
  Serial.println("Configuration loaded:");
  Serial.println("SSID: " + config.ssid);
  Serial.println("Device Name: " + config.deviceName);
}

void saveConfiguration() {
  preferences.putString("ssid", config.ssid);
  preferences.putString("password", config.password);
  preferences.putString("deviceName", config.deviceName);
  preferences.putString("apiKey", config.apiKey);
  preferences.putBool("otaEnabled", config.otaEnabled);
  preferences.putInt("sensorInterval", config.sensorInterval);
  preferences.putString("serverURL", config.serverURL);
  
  Serial.println("Configuration saved");
}

void connectToWiFi() {
  Serial.println("Connecting to WiFi: " + config.ssid);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(config.ssid.c_str(), config.password.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    blinkLED(1, 100);
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    isConnected = true;
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.println("IP address: " + WiFi.localIP().toString());
    
    // Set up mDNS
    if (MDNS.begin(config.deviceName.c_str())) {
      Serial.println("mDNS responder started");
      MDNS.addService("http", "tcp", 80);
    }
    
    digitalWrite(LED_STATUS_PIN, HIGH); // Solid LED = connected
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi");
    isConnected = false;
  }
}

void startConfigurationMode() {
  Serial.println("Starting configuration mode");
  isConfigMode = true;
  
  // Start access point
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(AP_IP, AP_GATEWAY, AP_SUBNET);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  
  // Start DNS server for captive portal
  dnsServer.start(53, "*", AP_IP);
  
  // Setup web server routes
  setupWebServerRoutes();
  
  server.begin();
  Serial.println("Configuration portal started");
  Serial.println("Connect to: " + String(AP_SSID));
  Serial.println("Password: " + String(AP_PASSWORD));
  Serial.println("Then open: http://192.168.4.1");
  
  // Blink LED to indicate config mode
  blinkLED(3, 200);
}

void setupWebServerRoutes() {
  // Main configuration page
  server.on("/", []() {
    server.send(200, "text/html", configPageHTML);
  });
  
  // Network scan endpoint
  server.on("/scan", []() {
    String json = scanNetworks();
    server.send(200, "application/json", json);
  });
  
  // Save configuration endpoint
  server.on("/save", HTTP_POST, []() {
    if (server.hasArg("plain")) {
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, server.arg("plain"));
      
      config.ssid = doc["ssid"].as<String>();
      config.password = doc["password"].as<String>();
      config.deviceName = doc["deviceName"].as<String>();
      config.apiKey = doc["apiKey"].as<String>();
      config.serverURL = doc["serverURL"].as<String>();
      config.otaEnabled = doc["otaEnabled"];
      config.sensorInterval = doc["sensorInterval"];
      
      saveConfiguration();
      
      server.send(200, "application/json", "{\"success\": true}");
      
      delay(1000);
      ESP.restart();
    } else {
      server.send(400, "application/json", "{\"success\": false, \"message\": \"No data received\"}");
    }
  });
  
  // Factory reset endpoint
  server.on("/reset", HTTP_POST, []() {
    server.send(200, "application/json", "{\"success\": true}");
    delay(1000);
    factoryReset();
  });
  
  // Captive portal redirect
  server.onNotFound([]() {
    server.sendHeader("Location", "http://192.168.4.1", true);
    server.send(302, "text/plain", "");
  });
}

String scanNetworks() {
  DynamicJsonDocument doc(2048);
  JsonArray networks = doc.createNestedArray("networks");
  
  int n = WiFi.scanNetworks();
  
  for (int i = 0; i < n; i++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(i);
    network["rssi"] = WiFi.RSSI(i);
    network["encryption"] = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "Open" : "Encrypted";
  }
  
  String result;
  serializeJson(doc, result);
  return result;
}

void startNormalOperation() {
  Serial.println("Starting normal operation mode");
  
  // Setup web server for device control
  server.on("/", []() {
    server.send(200, "text/plain", "ESP32 Device Online - " + config.deviceName);
  });
  
  server.on("/status", []() {
    DynamicJsonDocument doc(512);
    doc["device"] = config.deviceName;
    doc["uptime"] = millis();
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["rssi"] = WiFi.RSSI();
    doc["ip"] = WiFi.localIP().toString();
    
    String response;
    serializeJson(doc, response);
    server.send(200, "application/json", response);
  });
  
  server.on("/restart", HTTP_POST, []() {
    server.send(200, "text/plain", "Restarting...");
    delay(1000);
    ESP.restart();
  });
  
  server.begin();
  
  // Setup WebSocket for real-time data
  ws.onEvent(onWebSocketEvent);
  
  // Enable sensor power
  digitalWrite(SENSOR_POWER_PIN, HIGH);
}

void handleNormalOperation() {
  server.handleClient();
  ws.cleanupClients();
  
  // Send sensor data periodically
  if (millis() - lastSensorReading > (config.sensorInterval * 1000)) {
    sendSensorData();
    lastSensorReading = millis();
  }
  
  // Send heartbeat
  if (millis() - lastHeartbeat > 60000) { // Every minute
    sendHeartbeat();
    lastHeartbeat = millis();
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi connection lost, attempting reconnect...");
    connectToWiFi();
    if (!isConnected) {
      // If can't reconnect, restart in config mode
      delay(5000);
      ESP.restart();
    }
  }
}

void sendSensorData() {
  // Simulate sensor readings
  DynamicJsonDocument doc(512);
  doc["timestamp"] = millis();
  doc["device"] = config.deviceName;
  doc["temperature"] = 20.0 + random(-50, 150) / 10.0; // 15-35°C
  doc["humidity"] = 40.0 + random(0, 400) / 10.0;      // 40-80%
  doc["pressure"] = 1013.25 + random(-100, 100) / 10.0; // ±10 hPa
  
  String sensorData;
  serializeJson(doc, sensorData);
  
  // Send via WebSocket
  ws.textAll(sensorData);
  
  // Send to server if configured
  if (config.serverURL.length() > 0) {
    // HTTP POST implementation would go here
    Serial.println("Sending to server: " + sensorData);
  }
  
  Serial.println("Sensor data: " + sensorData);
}

void sendHeartbeat() {
  if (config.serverURL.length() > 0) {
    // Send heartbeat to server
    Serial.println("Sending heartbeat to server");
  }
}

void onWebSocketEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, 
                     AwsEventType type, void *arg, uint8_t *data, size_t len) {
  switch (type) {
    case WS_EVT_CONNECT:
      Serial.printf("WebSocket client #%u connected\n", client->id());
      break;
    case WS_EVT_DISCONNECT:
      Serial.printf("WebSocket client #%u disconnected\n", client->id());
      break;
    case WS_EVT_DATA:
      // Handle incoming WebSocket data
      break;
  }
}

void factoryReset() {
  Serial.println("Performing factory reset...");
  
  // Clear all preferences
  preferences.clear();
  
  // Clear WiFi credentials
  WiFi.disconnect(true);
  
  // Indicate reset with LED pattern
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(100);
    digitalWrite(LED_STATUS_PIN, LOW);
    delay(100);
  }
  
  Serial.println("Factory reset complete, restarting...");
  delay(1000);
  ESP.restart();
}

void blinkLED(int count, int duration) {
  for (int i = 0; i < count; i++) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(duration);
    digitalWrite(LED_STATUS_PIN, LOW);
    delay(duration);
  }
}
