/*
 * Bluetooth Low Energy (BLE) Communication Library for ESP32
 * Designed for medical device data transmission
 * 
 * Features:
 * - GATT server/client implementation
 * - Medical device profile support
 * - Secure pairing and encryption
 * - Real-time sensor data streaming
 * - Battery level monitoring
 * 
 * Author: Wireless Communication Team
 * Version: 1.8.2
 * Date: 2024-02-15
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_bt_defs.h>
#include <esp_gap_ble_api.h>
#include <esp_gattc_api.h>
#include <esp_gatt_common_api.h>

// Standard BLE Service UUIDs for Medical Devices
#define HEALTH_THERMOMETER_SERVICE_UUID    "00001809-0000-1000-8000-00805F9B34FB"
#define BLOOD_PRESSURE_SERVICE_UUID        "00001810-0000-1000-8000-00805F9B34FB"
#define HEART_RATE_SERVICE_UUID            "0000180D-0000-1000-8000-00805F9B34FB"
#define GLUCOSE_SERVICE_UUID               "00001808-0000-1000-8000-00805F9B34FB"
#define PULSE_OXIMETER_SERVICE_UUID        "00001822-0000-1000-8000-00805F9B34FB"

// Custom Medical Device Service
#define MEDICAL_DEVICE_SERVICE_UUID        "12345678-1234-1234-1234-123456789ABC"
#define SENSOR_DATA_CHARACTERISTIC_UUID    "12345678-1234-1234-1234-123456789ABD"
#define DEVICE_CONFIG_CHARACTERISTIC_UUID  "12345678-1234-1234-1234-123456789ABE"
#define ALERT_CHARACTERISTIC_UUID          "12345678-1234-1234-1234-123456789ABF"

// Device information
#define DEVICE_NAME                        "MedDevice-ESP32"
#define MANUFACTURER_NAME                  "Medical Instruments Corp"
#define MODEL_NUMBER                       "MD-ESP32-v2.1"
#define FIRMWARE_VERSION                   "1.8.2"

// BLE Configuration
#define BLE_MTU_SIZE                       512
#define MAX_CONNECTIONS                    3
#define ADVERTISING_INTERVAL_MS           1000
#define CONNECTION_TIMEOUT_MS             30000

// Security configuration
#define REQUIRE_PAIRING                    true
#define REQUIRE_ENCRYPTION                 true
#define IO_CAPABILITY                      ESP_IO_CAP_NONE

// Data structures
struct SensorData {
  uint32_t timestamp;
  float temperature;      // Celsius
  float humidity;         // Percentage
  uint16_t heartRate;     // BPM
  uint16_t oxygenSat;     // Percentage
  uint16_t bloodPressureSys;  // mmHg
  uint16_t bloodPressureDia;  // mmHg
  uint8_t batteryLevel;   // Percentage
  uint8_t deviceStatus;   // Status flags
};

struct DeviceConfig {
  uint16_t sampleRate;    // Samples per minute
  uint8_t alertThresholds[8];  // Various alert thresholds
  uint32_t patientId;     // Patient identifier
  uint8_t operatingMode;  // Operating mode flags
};

class MedicalBLEServer {
private:
  BLEServer* pServer;
  BLEService* pMedicalService;
  BLECharacteristic* pSensorDataChar;
  BLECharacteristic* pDeviceConfigChar;
  BLECharacteristic* pAlertChar;
  
  bool deviceConnected;
  bool oldDeviceConnected;
  uint32_t connectedClients;
  
  SensorData currentSensorData;
  DeviceConfig deviceConfig;
  
  // Security
  bool authenticationRequired;
  uint8_t bondedDevices[MAX_CONNECTIONS][6];  // MAC addresses
  
  // Timing
  unsigned long lastDataSent;
  unsigned long lastHeartbeat;
  unsigned long connectionStartTime;

public:
  MedicalBLEServer();
  
  // Initialization and setup
  bool begin();
  void setupSecurity();
  void createServices();
  void startAdvertising();
  
  // Data handling
  void updateSensorData(const SensorData& data);
  void sendSensorData();
  void sendAlert(uint8_t alertType, const String& message);
  
  // Configuration
  void setDeviceConfig(const DeviceConfig& config);
  DeviceConfig getDeviceConfig();
  
  // Connection management
  bool isConnected();
  uint32_t getConnectedClients();
  void disconnectAll();
  
  // Security
  void addBondedDevice(uint8_t* macAddress);
  bool isDeviceBonded(uint8_t* macAddress);
  void clearBondedDevices();
  
  // Maintenance
  void handleLoop();
  void reset();
  
  // Callbacks
  void setDataRequestCallback(void (*callback)(SensorData*));
  void setConfigUpdateCallback(void (*callback)(const DeviceConfig&));
  void setConnectionCallback(void (*callback)(bool connected, uint8_t* macAddress));
};

// Server callbacks for connection events
class MedicalServerCallbacks: public BLEServerCallbacks {
private:
  MedicalBLEServer* parentServer;
  
public:
  MedicalServerCallbacks(MedicalBLEServer* server) : parentServer(server) {}
  
  void onConnect(BLEServer* pServer) {
    Serial.println("BLE Client connected");
    
    // Get client MAC address
    esp_bd_addr_t clientAddr;
    esp_ble_gap_get_whitelist_size(&clientAddr);
    
    // Update connection status
    parentServer->connectedClients++;
    parentServer->deviceConnected = true;
    parentServer->connectionStartTime = millis();
    
    // Security check
    if (REQUIRE_PAIRING && !parentServer->isDeviceBonded(clientAddr)) {
      Serial.println("Initiating pairing process");
      esp_ble_auth_req(ESP_LE_AUTH_REQ_SC_MITM_BOND);
    }
    
    // Notify application
    if (parentServer->connectionCallback) {
      parentServer->connectionCallback(true, clientAddr);
    }
  }
  
  void onDisconnect(BLEServer* pServer) {
    Serial.println("BLE Client disconnected");
    
    parentServer->connectedClients--;
    if (parentServer->connectedClients == 0) {
      parentServer->deviceConnected = false;
      parentServer->oldDeviceConnected = true;
    }
    
    // Restart advertising after short delay
    delay(500);
    parentServer->startAdvertising();
  }
  
  void onAuthenticationComplete(esp_ble_auth_cmpl_t authResult) {
    if (authResult.success) {
      Serial.println("Authentication successful");
      parentServer->addBondedDevice(authResult.bd_addr);
    } else {
      Serial.printf("Authentication failed: %d\n", authResult.fail_reason);
      // Disconnect unauthorized device
      pServer->disconnect(pServer->getConnId());
    }
  }
};

// Characteristic callbacks for data handling
class ConfigCharacteristicCallbacks: public BLECharacteristicCallbacks {
private:
  MedicalBLEServer* parentServer;
  
public:
  ConfigCharacteristicCallbacks(MedicalBLEServer* server) : parentServer(server) {}
  
  void onWrite(BLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    
    if (value.length() == sizeof(DeviceConfig)) {
      DeviceConfig newConfig;
      memcpy(&newConfig, value.data(), sizeof(DeviceConfig));
      
      // Validate configuration
      if (validateConfig(newConfig)) {
        parentServer->setDeviceConfig(newConfig);
        Serial.println("Device configuration updated");
        
        // Notify application
        if (parentServer->configUpdateCallback) {
          parentServer->configUpdateCallback(newConfig);
        }
      } else {
        Serial.println("Invalid configuration received");
        parentServer->sendAlert(0x01, "Invalid configuration");
      }
    }
  }
  
  void onRead(BLECharacteristic* pCharacteristic) {
    DeviceConfig config = parentServer->getDeviceConfig();
    pCharacteristic->setValue((uint8_t*)&config, sizeof(DeviceConfig));
  }
  
private:
  bool validateConfig(const DeviceConfig& config) {
    // Validate sample rate
    if (config.sampleRate < 1 || config.sampleRate > 60) {
      return false;
    }
    
    // Validate operating mode
    if (config.operatingMode > 0x0F) {
      return false;
    }
    
    return true;
  }
};

// Implementation
MedicalBLEServer::MedicalBLEServer() {
  deviceConnected = false;
  oldDeviceConnected = false;
  connectedClients = 0;
  authenticationRequired = REQUIRE_PAIRING;
  lastDataSent = 0;
  lastHeartbeat = 0;
  connectionStartTime = 0;
  
  // Initialize default configuration
  deviceConfig.sampleRate = 10;  // 10 samples per minute
  deviceConfig.patientId = 0;
  deviceConfig.operatingMode = 0x01;  // Normal mode
  memset(deviceConfig.alertThresholds, 0, sizeof(deviceConfig.alertThresholds));
  
  // Initialize sensor data
  memset(&currentSensorData, 0, sizeof(currentSensorData));
}

bool MedicalBLEServer::begin() {
  Serial.println("Initializing Medical BLE Server...");
  
  // Initialize BLE
  BLEDevice::init(DEVICE_NAME);
  
  // Set MTU size for medical data
  BLEDevice::setMTU(BLE_MTU_SIZE);
  
  // Create BLE Server
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MedicalServerCallbacks(this));
  
  // Setup security
  setupSecurity();
  
  // Create services and characteristics
  createServices();
  
  // Start advertising
  startAdvertising();
  
  Serial.println("Medical BLE Server initialized successfully");
  return true;
}

void MedicalBLEServer::setupSecurity() {
  if (!REQUIRE_ENCRYPTION) return;
  
  // Set security parameters
  esp_ble_auth_req_t auth_req = ESP_LE_AUTH_REQ_SC_MITM_BOND;
  esp_ble_io_cap_t iocap = IO_CAPABILITY;
  uint8_t key_size = 16;
  uint8_t init_key = ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK;
  uint8_t rsp_key = ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK;
  
  esp_ble_gap_set_security_param(ESP_BLE_SM_AUTHEN_REQ_MODE, &auth_req, sizeof(uint8_t));
  esp_ble_gap_set_security_param(ESP_BLE_SM_IOCAP_MODE, &iocap, sizeof(uint8_t));
  esp_ble_gap_set_security_param(ESP_BLE_SM_MAX_KEY_SIZE, &key_size, sizeof(uint8_t));
  esp_ble_gap_set_security_param(ESP_BLE_SM_SET_INIT_KEY, &init_key, sizeof(uint8_t));
  esp_ble_gap_set_security_param(ESP_BLE_SM_SET_RSP_KEY, &rsp_key, sizeof(uint8_t));
  
  Serial.println("BLE Security configured");
}

void MedicalBLEServer::createServices() {
  // Create medical device service
  pMedicalService = pServer->createService(MEDICAL_DEVICE_SERVICE_UUID);
  
  // Sensor data characteristic (notify)
  pSensorDataChar = pMedicalService->createCharacteristic(
    SENSOR_DATA_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY
  );
  pSensorDataChar->addDescriptor(new BLE2902());
  
  // Device configuration characteristic (read/write)
  pDeviceConfigChar = pMedicalService->createCharacteristic(
    DEVICE_CONFIG_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_WRITE
  );
  pDeviceConfigChar->setCallbacks(new ConfigCharacteristicCallbacks(this));
  
  // Alert characteristic (notify)
  pAlertChar = pMedicalService->createCharacteristic(
    ALERT_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pAlertChar->addDescriptor(new BLE2902());
  
  // Create Device Information Service
  BLEService* pDeviceInfoService = pServer->createService("0000180A-0000-1000-8000-00805F9B34FB");
  
  BLECharacteristic* pManufacturerChar = pDeviceInfoService->createCharacteristic(
    "00002A29-0000-1000-8000-00805F9B34FB",
    BLECharacteristic::PROPERTY_READ
  );
  pManufacturerChar->setValue(MANUFACTURER_NAME);
  
  BLECharacteristic* pModelChar = pDeviceInfoService->createCharacteristic(
    "00002A24-0000-1000-8000-00805F9B34FB",
    BLECharacteristic::PROPERTY_READ
  );
  pModelChar->setValue(MODEL_NUMBER);
  
  BLECharacteristic* pFirmwareChar = pDeviceInfoService->createCharacteristic(
    "00002A26-0000-1000-8000-00805F9B34FB",
    BLECharacteristic::PROPERTY_READ
  );
  pFirmwareChar->setValue(FIRMWARE_VERSION);
  
  // Start services
  pMedicalService->start();
  pDeviceInfoService->start();
  
  Serial.println("BLE Services created and started");
}

void MedicalBLEServer::startAdvertising() {
  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  
  // Add service UUIDs to advertisement
  pAdvertising->addServiceUUID(MEDICAL_DEVICE_SERVICE_UUID);
  pAdvertising->addServiceUUID("0000180A-0000-1000-8000-00805F9B34FB");  // Device Info
  
  // Set advertising parameters
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  
  // Set device appearance (medical device)
  esp_ble_gap_set_device_name(DEVICE_NAME);
  esp_ble_gap_config_adv_data_raw(nullptr, 0);
  
  BLEDevice::startAdvertising();
  Serial.println("BLE Advertising started");
}

void MedicalBLEServer::updateSensorData(const SensorData& data) {
  currentSensorData = data;
  currentSensorData.timestamp = millis();
  
  // Send data if connected and enough time has passed
  unsigned long currentTime = millis();
  unsigned long interval = 60000 / deviceConfig.sampleRate;  // Convert to milliseconds
  
  if (deviceConnected && (currentTime - lastDataSent >= interval)) {
    sendSensorData();
    lastDataSent = currentTime;
  }
}

void MedicalBLEServer::sendSensorData() {
  if (!deviceConnected) return;
  
  // Set characteristic value and notify
  pSensorDataChar->setValue((uint8_t*)&currentSensorData, sizeof(SensorData));
  pSensorDataChar->notify();
  
  Serial.printf("Sensor data sent: T=%.1f°C, HR=%d BPM, SpO2=%d%%\n",
    currentSensorData.temperature,
    currentSensorData.heartRate,
    currentSensorData.oxygenSat
  );
}

void MedicalBLEServer::sendAlert(uint8_t alertType, const String& message) {
  if (!deviceConnected) return;
  
  // Create alert packet
  struct AlertPacket {
    uint8_t alertType;
    uint32_t timestamp;
    uint8_t messageLength;
    char message[64];
  } alertPacket;
  
  alertPacket.alertType = alertType;
  alertPacket.timestamp = millis();
  alertPacket.messageLength = min(message.length(), 63);
  strncpy(alertPacket.message, message.c_str(), alertPacket.messageLength);
  alertPacket.message[alertPacket.messageLength] = '\0';
  
  pAlertChar->setValue((uint8_t*)&alertPacket, sizeof(AlertPacket));
  pAlertChar->notify();
  
  Serial.printf("Alert sent: Type=%d, Message=%s\n", alertType, message.c_str());
}

void MedicalBLEServer::handleLoop() {
  // Handle connection state changes
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);  // Give bluetooth stack time to get ready
    startAdvertising();
    Serial.println("Restarted advertising");
    oldDeviceConnected = deviceConnected;
  }
  
  // Send heartbeat
  unsigned long currentTime = millis();
  if (deviceConnected && (currentTime - lastHeartbeat >= 30000)) {  // Every 30 seconds
    sendAlert(0xFF, "Heartbeat");
    lastHeartbeat = currentTime;
  }
  
  // Check connection timeout
  if (deviceConnected && (currentTime - connectionStartTime >= CONNECTION_TIMEOUT_MS)) {
    Serial.println("Connection timeout - checking if client is still alive");
    // Could implement ping/pong mechanism here
  }
}

bool MedicalBLEServer::isConnected() {
  return deviceConnected;
}

uint32_t MedicalBLEServer::getConnectedClients() {
  return connectedClients;
}

void MedicalBLEServer::setDeviceConfig(const DeviceConfig& config) {
  deviceConfig = config;
  
  // Update configuration characteristic
  pDeviceConfigChar->setValue((uint8_t*)&deviceConfig, sizeof(DeviceConfig));
}

DeviceConfig MedicalBLEServer::getDeviceConfig() {
  return deviceConfig;
}

// Global instance for easy access
MedicalBLEServer medicalBLE;

// Arduino setup and loop
void setup() {
  Serial.begin(115200);
  Serial.println("Starting Medical BLE Device...");
  
  // Initialize BLE server
  if (medicalBLE.begin()) {
    Serial.println("Medical BLE Server started successfully");
  } else {
    Serial.println("Failed to start Medical BLE Server");
    return;
  }
  
  // Set initial sensor data
  SensorData initialData = {
    .timestamp = 0,
    .temperature = 36.5,
    .humidity = 45.0,
    .heartRate = 72,
    .oxygenSat = 98,
    .bloodPressureSys = 120,
    .bloodPressureDia = 80,
    .batteryLevel = 85,
    .deviceStatus = 0x01
  };
  
  medicalBLE.updateSensorData(initialData);
}

void loop() {
  // Handle BLE events
  medicalBLE.handleLoop();
  
  // Simulate sensor readings
  static unsigned long lastReading = 0;
  if (millis() - lastReading >= 5000) {  // Every 5 seconds
    SensorData data;
    data.temperature = 36.0 + random(0, 20) / 10.0;  // 36.0-37.9°C
    data.humidity = 40.0 + random(0, 300) / 10.0;    // 40-70%
    data.heartRate = 60 + random(0, 40);             // 60-99 BPM
    data.oxygenSat = 95 + random(0, 5);              // 95-99%
    data.bloodPressureSys = 110 + random(0, 30);     // 110-139 mmHg
    data.bloodPressureDia = 70 + random(0, 20);      // 70-89 mmHg
    data.batteryLevel = 80 + random(0, 20);          // 80-99%
    data.deviceStatus = 0x01;                        // Normal operation
    
    medicalBLE.updateSensorData(data);
    lastReading = millis();
  }
  
  delay(100);
}
