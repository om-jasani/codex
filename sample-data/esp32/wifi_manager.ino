/*
 * ESP32 WiFi Manager with Web Server
 * Creates a WiFi access point for configuration
 * Serves web interface for WiFi setup and sensor monitoring
 */

#include <WiFi.h>
#include <WebServer.h>
#include <EEPROM.h>
#include <DHT.h>

// Pin definitions
#define DHT_PIN 4
#define LED_PIN 2
#define BUTTON_PIN 0

// DHT sensor setup
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

// Web server on port 80
WebServer server(80);

// WiFi credentials
String ssid = "";
String password = "";
bool wifiConfigMode = false;

// Sensor data
float temperature = 0.0;
float humidity = 0.0;
unsigned long lastSensorRead = 0;

void setup() {
  Serial.begin(115200);
  Serial.println("\nESP32 WiFi Manager Starting...");
  
  // Initialize pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Initialize DHT sensor
  dht.begin();
  
  // Initialize EEPROM
  EEPROM.begin(512);
  
  // Load WiFi credentials from EEPROM
  loadWiFiCredentials();
  
  // Check if button is pressed on startup (config mode)
  if (digitalRead(BUTTON_PIN) == LOW) {
    wifiConfigMode = true;
    Serial.println("Entering WiFi configuration mode...");
  }
  
  if (wifiConfigMode || ssid.length() == 0) {
    startConfigMode();
  } else {
    connectToWiFi();
  }
  
  setupWebServer();
  server.begin();
  Serial.println("Web server started");
}

void loop() {
  server.handleClient();
  
  // Read sensors every 2 seconds
  if (millis() - lastSensorRead > 2000) {
    readSensors();
    lastSensorRead = millis();
  }
  
  // Check for config button press
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      Serial.println("Config button pressed - restarting in config mode");
      wifiConfigMode = true;
      ESP.restart();
    }
  }
  
  // Blink LED to show status
  blinkStatusLED();
  
  delay(100);
}

void startConfigMode() {
  Serial.println("Starting AP mode for configuration");
  
  // Create access point
  WiFi.softAP("ESP32-Config", "12345678");
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  
  wifiConfigMode = true;
}

void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid.c_str(), password.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed - starting config mode");
    startConfigMode();
  }
}

void setupWebServer() {
  // Main page
  server.on("/", handleRoot);
  
  // Configuration page
  server.on("/config", handleConfig);
  
  // Save WiFi settings
  server.on("/save", handleSave);
  
  // API endpoints
  server.on("/api/status", handleAPIStatus);
  server.on("/api/sensors", handleAPISensors);
  
  // Reset settings
  server.on("/reset", handleReset);
  
  server.onNotFound(handleNotFound);
}

void handleRoot() {
  String html = generateMainPage();
  server.send(200, "text/html", html);
}

void handleConfig() {
  String html = generateConfigPage();
  server.send(200, "text/html", html);
}

void handleSave() {
  ssid = server.arg("ssid");
  password = server.arg("password");
  
  saveWiFiCredentials();
  
  String response = "Settings saved! Restarting...";
  server.send(200, "text/plain", response);
  
  delay(1000);
  ESP.restart();
}

void handleAPIStatus() {
  String json = "{";
  json += "\"wifi_connected\":" + String(WiFi.status() == WL_CONNECTED ? "true" : "false") + ",";
  json += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  json += "\"rssi\":" + String(WiFi.RSSI()) + ",";
  json += "\"uptime\":" + String(millis()) + ",";
  json += "\"free_heap\":" + String(ESP.getFreeHeap());
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleAPISensors() {
  String json = "{";
  json += "\"temperature\":" + String(temperature) + ",";
  json += "\"humidity\":" + String(humidity) + ",";
  json += "\"timestamp\":" + String(millis());
  json += "}";
  
  server.send(200, "application/json", json);
}

void handleReset() {
  clearWiFiCredentials();
  server.send(200, "text/plain", "Settings cleared! Restarting...");
  delay(1000);
  ESP.restart();
}

void handleNotFound() {
  server.send(404, "text/plain", "Not Found");
}

String generateMainPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>ESP32 Sensor Monitor</title>";
  html += "<meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:40px;background:#f0f0f0}";
  html += ".container{max-width:600px;margin:0 auto;background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}";
  html += ".sensor{background:#e3f2fd;padding:20px;margin:15px 0;border-radius:8px}";
  html += ".value{font-size:2em;font-weight:bold;color:#1976d2}";
  html += "button{background:#2196f3;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin:5px}";
  html += "button:hover{background:#1976d2}";
  html += "</style>";
  html += "<script>";
  html += "function updateSensors(){";
  html += "fetch('/api/sensors').then(r=>r.json()).then(data=>{";
  html += "document.getElementById('temp').innerHTML=data.temperature.toFixed(1)+'°C';";
  html += "document.getElementById('hum').innerHTML=data.humidity.toFixed(1)+'%';";
  html += "});};";
  html += "setInterval(updateSensors,2000);";
  html += "</script>";
  html += "</head><body>";
  html += "<div class='container'>";
  html += "<h1>ESP32 Sensor Monitor</h1>";
  html += "<div class='sensor'>";
  html += "<h3>Temperature</h3>";
  html += "<div class='value' id='temp'>" + String(temperature) + "°C</div>";
  html += "</div>";
  html += "<div class='sensor'>";
  html += "<h3>Humidity</h3>";
  html += "<div class='value' id='hum'>" + String(humidity) + "%</div>";
  html += "</div>";
  html += "<button onclick='location.href=\"/config\"'>WiFi Settings</button>";
  html += "<button onclick='updateSensors()'>Refresh</button>";
  html += "</div></body></html>";
  
  return html;
}

String generateConfigPage() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<title>WiFi Configuration</title>";
  html += "<meta charset='utf-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1'>";
  html += "<style>";
  html += "body{font-family:Arial,sans-serif;margin:40px;background:#f0f0f0}";
  html += ".container{max-width:400px;margin:0 auto;background:white;padding:30px;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,0.1)}";
  html += "input{width:100%;padding:10px;margin:10px 0;border:1px solid #ddd;border-radius:5px;box-sizing:border-box}";
  html += "button{background:#4caf50;color:white;border:none;padding:15px;width:100%;border-radius:5px;cursor:pointer;font-size:16px}";
  html += "button:hover{background:#45a049}";
  html += ".danger{background:#f44336}";
  html += ".danger:hover{background:#da190b}";
  html += "</style>";
  html += "</head><body>";
  html += "<div class='container'>";
  html += "<h2>WiFi Configuration</h2>";
  html += "<form action='/save' method='post'>";
  html += "<input type='text' name='ssid' placeholder='WiFi Network Name (SSID)' value='" + ssid + "' required>";
  html += "<input type='password' name='password' placeholder='WiFi Password'>";
  html += "<button type='submit'>Save & Restart</button>";
  html += "</form>";
  html += "<br>";
  html += "<button class='danger' onclick='if(confirm(\"Clear all settings?\"))location.href=\"/reset\"'>Reset Settings</button>";
  html += "</div></body></html>";
  
  return html;
}

void readSensors() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor!");
    temperature = 0.0;
    humidity = 0.0;
  }
}

void blinkStatusLED() {
  static unsigned long lastBlink = 0;
  static bool ledState = false;
  
  unsigned long interval = WiFi.status() == WL_CONNECTED ? 2000 : 500;
  
  if (millis() - lastBlink > interval) {
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
    lastBlink = millis();
  }
}

void saveWiFiCredentials() {
  EEPROM.writeString(0, ssid);
  EEPROM.writeString(100, password);
  EEPROM.commit();
  Serial.println("WiFi credentials saved to EEPROM");
}

void loadWiFiCredentials() {
  ssid = EEPROM.readString(0);
  password = EEPROM.readString(100);
  
  Serial.println("Loaded WiFi credentials from EEPROM");
  Serial.println("SSID: " + ssid);
}

void clearWiFiCredentials() {
  for (int i = 0; i < 512; i++) {
    EEPROM.write(i, 0);
  }
  EEPROM.commit();
  Serial.println("WiFi credentials cleared from EEPROM");
}
