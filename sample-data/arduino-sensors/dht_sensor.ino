/*
 * Temperature and Humidity Sensor Library
 * For DHT22/DHT11 sensors with Arduino
 * 
 * Author: Medical Instruments Team
 * Date: 2024-01-15
 * Version: 1.2.0
 */

#include <DHT.h>
#include <WiFi.h>
#include <ArduinoJson.h>

// Pin definitions
#define DHT_PIN 2
#define DHT_TYPE DHT22
#define LED_PIN 13

// DHT sensor instance
DHT dht(DHT_PIN, DHT_TYPE);

// Network credentials
const char* ssid = "your_wifi_network";
const char* password = "your_wifi_password";

// Data structure for sensor readings
struct SensorReading {
  float temperature;
  float humidity;
  unsigned long timestamp;
  bool isValid;
};

// Global variables
SensorReading lastReading;
bool wifiConnected = false;
unsigned long lastReadTime = 0;
const unsigned long READ_INTERVAL = 5000; // 5 seconds

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  
  // Initialize DHT sensor
  dht.begin();
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("Temperature/Humidity sensor initialized");
  Serial.println("Reading interval: 5 seconds");
}

void loop() {
  unsigned long currentTime = millis();
  
  // Read sensor data at specified interval
  if (currentTime - lastReadTime >= READ_INTERVAL) {
    SensorReading reading = readSensorData();
    
    if (reading.isValid) {
      lastReading = reading;
      displayReading(reading);
      
      // Send data over WiFi if connected
      if (wifiConnected) {
        sendDataToServer(reading);
      }
      
      // Blink LED to indicate successful reading
      blinkLED(2, 100);
    } else {
      Serial.println("Failed to read sensor data");
      blinkLED(5, 50); // Error indication
    }
    
    lastReadTime = currentTime;
  }
  
  // Check WiFi connection status
  if (WiFi.status() != WL_CONNECTED && wifiConnected) {
    wifiConnected = false;
    Serial.println("WiFi connection lost");
  }
  
  delay(100); // Small delay to prevent busy waiting
}

/**
 * Read temperature and humidity from DHT sensor
 * @return SensorReading structure with data and validity flag
 */
SensorReading readSensorData() {
  SensorReading reading;
  reading.timestamp = millis();
  
  // Read humidity and temperature
  reading.humidity = dht.readHumidity();
  reading.temperature = dht.readTemperature();
  
  // Check if readings are valid
  reading.isValid = !isnan(reading.humidity) && !isnan(reading.temperature);
  
  return reading;
}

/**
 * Display sensor reading on serial monitor
 * @param reading The sensor reading to display
 */
void displayReading(SensorReading reading) {
  Serial.print("Temperature: ");
  Serial.print(reading.temperature);
  Serial.print("°C, Humidity: ");
  Serial.print(reading.humidity);
  Serial.print("%, Time: ");
  Serial.println(reading.timestamp);
}

/**
 * Connect to WiFi network
 */
void connectToWiFi() {
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.print("Connected to WiFi! IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi");
  }
}

/**
 * Send sensor data to remote server via HTTP POST
 * @param reading The sensor reading to send
 */
void sendDataToServer(SensorReading reading) {
  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["temperature"] = reading.temperature;
  doc["humidity"] = reading.humidity;
  doc["timestamp"] = reading.timestamp;
  doc["device_id"] = "sensor_001";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  // TODO: Implement HTTP POST to data server
  // This would typically use WiFiClient or HTTPClient
  Serial.println("Data payload: " + jsonString);
}

/**
 * Blink LED for visual feedback
 * @param count Number of blinks
 * @param duration Duration of each blink in milliseconds
 */
void blinkLED(int count, int duration) {
  for (int i = 0; i < count; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(duration);
    digitalWrite(LED_PIN, LOW);
    delay(duration);
  }
}

/**
 * Get the last valid sensor reading
 * @return Last valid sensor reading
 */
SensorReading getLastReading() {
  return lastReading;
}

/**
 * Check if sensor data is within normal ranges
 * @param reading The reading to validate
 * @return true if reading is within normal ranges
 */
bool isReadingInRange(SensorReading reading) {
  const float MIN_TEMP = -40.0;
  const float MAX_TEMP = 80.0;
  const float MIN_HUMIDITY = 0.0;
  const float MAX_HUMIDITY = 100.0;
  
  return (reading.temperature >= MIN_TEMP && reading.temperature <= MAX_TEMP &&
          reading.humidity >= MIN_HUMIDITY && reading.humidity <= MAX_HUMIDITY);
}

/**
 * Calculate heat index based on temperature and humidity
 * @param temp Temperature in Celsius
 * @param humidity Relative humidity percentage
 * @return Heat index in Celsius
 */
float calculateHeatIndex(float temp, float humidity) {
  // Convert to Fahrenheit for calculation
  float tempF = temp * 9.0/5.0 + 32.0;
  
  // Heat index formula (simplified)
  float hi = tempF;
  if (tempF >= 80.0) {
    hi = -42.379 + 2.04901523 * tempF + 10.14333127 * humidity
         - 0.22475541 * tempF * humidity - 6.83783e-3 * tempF * tempF
         - 5.481717e-2 * humidity * humidity + 1.22874e-3 * tempF * tempF * humidity
         + 8.5282e-4 * tempF * humidity * humidity - 1.99e-6 * tempF * tempF * humidity * humidity;
  }
  
  // Convert back to Celsius
  return (hi - 32.0) * 5.0/9.0;
}
