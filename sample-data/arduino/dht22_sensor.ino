/*
 * DHT22 Temperature and Humidity Sensor
 * Reads temperature and humidity from DHT22 sensor
 * Displays values on Serial monitor and LCD
 */

#include <DHT.h>
#include <LiquidCrystal.h>

#define DHT_PIN 2
#define DHT_TYPE DHT22

// Initialize DHT sensor
DHT dht(DHT_PIN, DHT_TYPE);

// Initialize LCD (RS, EN, D4, D5, D6, D7)
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  Serial.println("DHT22 Temperature & Humidity Sensor");
  
  // Initialize LCD
  lcd.begin(16, 2);
  lcd.print("DHT22 Sensor");
  lcd.setCursor(0, 1);
  lcd.print("Initializing...");
  
  // Initialize DHT sensor
  dht.begin();
  
  delay(2000);
  lcd.clear();
}

void loop() {
  // Read humidity and temperature
  float humidity = dht.readHumidity();
  float temperature = dht.readTemperature();
  
  // Check if readings are valid
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("Failed to read from DHT sensor!");
    lcd.clear();
    lcd.print("Sensor Error!");
    return;
  }
  
  // Display on Serial monitor
  Serial.print("Humidity: ");
  Serial.print(humidity);
  Serial.print("%  Temperature: ");
  Serial.print(temperature);
  Serial.println("°C");
  
  // Display on LCD
  lcd.clear();
  lcd.print("Temp: ");
  lcd.print(temperature);
  lcd.print("C");
  
  lcd.setCursor(0, 1);
  lcd.print("Humidity: ");
  lcd.print(humidity);
  lcd.print("%");
  
  delay(2000);
}

// Function to calculate heat index
float calculateHeatIndex(float temperature, float humidity) {
  float heatIndex = temperature;
  
  if (temperature >= 27) {
    float t2 = temperature * temperature;
    float h2 = humidity * humidity;
    
    heatIndex = -8.784695 + 1.61139411 * temperature + 2.338549 * humidity
                - 0.14611605 * temperature * humidity
                - 0.012308094 * t2
                - 0.016424828 * h2
                + 0.002211732 * t2 * humidity
                + 0.00072546 * temperature * h2
                - 0.000003582 * t2 * h2;
  }
  
  return heatIndex;
}
