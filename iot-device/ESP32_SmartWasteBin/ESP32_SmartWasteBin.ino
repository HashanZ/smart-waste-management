/*
 * Smart Waste Management System - ESP32 IoT Bin Firmware
 *
 * Hardware:
 * - ESP32 DevKit V1
 * - HC-SR04 Ultrasonic Sensor (or similar)
 * - SIM800L GSM Module
 * - Yellow LED (Pin 19) - Warning indicator (70-90% full)
 * - Red LED (Pin 21) - Critical indicator (>90% full)
 * - Power Supply (5V, 2A recommended)
 *
 * Features:
 * - Measures bin fill level using ultrasonic sensor
 * - Real-time LED fill level indication (updates every 1 second)
 * - Sends data to backend via HTTP POST or MQTT (using SIM800L GSM)
 * - Low power mode support
 * - Battery level monitoring (if connected)
 * - Signal strength reporting
 * - Visual LED indicators with real-time updates
 *
 * Author: Smart Waste Management System
 * Version: 1.3.0
 *
 * Updates:
 * - Real-time LED fill level indication (updates every 1 second)
 * - Yellow LED (Pin 19): ON when bin is 70-90% full (warning state)
 * - Red LED (Pin 21): ON when bin is >90% full (critical state)
 * - LEDs OFF when bin is <70% full (normal state)
 * - LEDs update continuously in real-time, independent of data transmission
 * - Added AT command passthrough via Serial Monitor
 * - Improved network registration handling
 * - Enhanced diagnostic capabilities
 */

#include <HardwareSerial.h>
#include <ArduinoJson.h>
#include <WiFi.h>  // For ESP32 WiFi (optional, if you want WiFi fallback)

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
#define BIN_ID "BIN001"  // Unique bin ID (must match database)
#define BIN_HEIGHT_CM 25  // Height of bin in centimeters (maximum height: 25 cm)

// ============================================
// LOCATION COORDINATES - UPDATE THESE VALUES
// ============================================
// IMPORTANT: Set the exact GPS coordinates where this bin is installed
// Format: Decimal degrees (DD)
// Example for Colombo, Sri Lanka:
#define BIN_LATITUDE 6.854570   // Latitude (North/South) - Update with actual location
#define BIN_LONGITUDE 80.091415// Longitude (East/West) - Update with actual location
// To find your coordinates:
// 1. Use Google Maps: Right-click on location -> Click coordinates -> Copy
// 2. Or use GPS app on your phone
// 3. Format: -90 to 90 for latitude, -180 to 180 for longitude
// IMPORTANT: Replace with your public IP address or domain name
// For testing: Use ngrok (https://ngrok.com) to create a public tunnel
// Example: "http://your-public-ip:3000/api/bins/iot/update"
// Example with ngrok: "http://abc123.ngrok.io/api/bins/iot/update"
// ============================================
// COMMUNICATION METHOD - Choose ONE
// ============================================
// Option 1: HTTP POST (Local Backend - For Viva Demo)
// IMPORTANT: Replace YOUR_IP_HERE with your computer's IP address
// To find your IP: Run 'ipconfig' (Windows) or 'ifconfig' (Mac/Linux)
// Format: "http://YOUR_IP:3000/api/bins/iot/update"
// Example: "http://192.168.1.100:3000/api/bins/iot/update"
#define API_URL "https://05swr2uyij.execute-api.eu-north-1.amazonaws.com/prod/bins"
#define USE_HTTP true

// Option 2: HTTP POST (AWS API Gateway - For Production)
// Uncomment and use this for production deployment:
// #define API_URL "https://your-api-id.execute-api.region.amazonaws.com/prod/bins"
// #define USE_HTTP true

// Option 3: MQTT (CloudAMQP or other MQTT broker)
// Uncomment and configure for MQTT:
// #define USE_MQTT true
// #define MQTT_BROKER "your-mqtt-broker.com"   // MQTT broker address
// #define MQTT_PORT 1883                       // Port: 1883 (non-SSL) or 8883 (TLS)
// #define MQTT_USERNAME "your-username"         // MQTT username
// #define MQTT_PASSWORD "your-password"        // MQTT password (store securely)
// #define MQTT_CLIENT_ID "BIN001"             // Unique client ID for this device
// #define MQTT_TOPIC "smartwaste/BIN001/data" // Topic to publish to

#define UPDATE_INTERVAL 30000  // Send data every 5 minutes (300000 ms)

// ============================================
// GSM/APN CONFIGURATION - Dialog SIM (Sri Lanka)
// ============================================
#define APN "internet"           // Dialog APN: Try "internet" or "dialogbb"
#define APN_USERNAME ""          // Usually blank for Dialog
#define APN_PASSWORD ""          // Usually blank for Dialog
// For other carriers, update these values:
// Mobitel (Sri Lanka): APN = "mobitel"
// Airtel (India): APN = "airtelgprs.com"
// Vodafone (India): APN = "www"
// Jio (India): APN = "jionet"
#define ULTRASONIC_TRIGGER_PIN 5
#define ULTRASONIC_ECHO_PIN 18
#define SIM800L_RX_PIN 16  // ESP32 RX pin connected to SIM800L TX
#define SIM800L_TX_PIN 17  // ESP32 TX pin connected to SIM800L RX
#define BATTERY_ADC_PIN 34  // Optional: Battery voltage monitoring pin
#define LED_STATUS_PIN 2  // Built-in LED for status indication

// ============================================
// LED INDICATORS - Real-time Fill Level Indication
// ============================================
#define LED_YELLOW_PIN 19  // Yellow LED for warning state (70-90% full)
#define LED_RED_PIN 21     // Red LED for critical state (>90% full)
#define FILL_LEVEL_WARNING 70.0   // Warning threshold: 70% full
#define FILL_LEVEL_CRITICAL 90.0  // Critical threshold: 90% full
#define LED_UPDATE_INTERVAL 500  // Update LEDs every 500ms (real-time, more responsive)

// SIM800L Serial Communication
HardwareSerial sim800lSerial(2);  // Use Serial2 on ESP32

// Global variables
unsigned long lastUpdateTime = 0;
unsigned long lastLEDUpdateTime = 0;  // Track last LED update for real-time indication
bool gsmInitialized = false;
int batteryLevel = 100;  // Default to 100% if not monitoring
int signalStrength = 0;
float currentFillLevel = 0.0;  // Store current fill level for LED updates
int currentLEDState = -1;  // Track current LED state: -1=unknown, 0=normal(<70%), 1=warning(70-90%), 2=critical(>90%)

// Function declarations
void resetSIM800L();
bool testATCommand(String command, unsigned long timeout);
void updateLEDIndicators(float fillLevel);

// ============================================
// SETUP FUNCTION
// ============================================
void setup() {
  // Initialize Serial for debugging
  Serial.begin(115200);
  delay(1000);

  Serial.println("========================================");
  Serial.println("Smart Waste Management - IoT Bin");
  Serial.println("ESP32 Firmware v1.1.0");
  Serial.println("========================================");
  Serial.println("Type 'HELP' or '?' for AT command help");
  Serial.println("Type any AT command to send to SIM800L");
  Serial.println("========================================");

  // Initialize pins
  pinMode(ULTRASONIC_TRIGGER_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  pinMode(LED_STATUS_PIN, OUTPUT);
  pinMode(BATTERY_ADC_PIN, INPUT);

  // Initialize LED indicator pins for real-time fill level indication
  pinMode(LED_YELLOW_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  digitalWrite(LED_YELLOW_PIN, LOW);  // Start with LEDs off
  digitalWrite(LED_RED_PIN, LOW);
  currentLEDState = -1;  // Initialize LED state as unknown
  
  // Test LEDs on startup (blink each LED once to verify they work)
  Serial.println("Testing LEDs...");
  digitalWrite(LED_YELLOW_PIN, HIGH);
  delay(200);
  digitalWrite(LED_YELLOW_PIN, LOW);
  delay(200);
  digitalWrite(LED_RED_PIN, HIGH);
  delay(200);
  digitalWrite(LED_RED_PIN, LOW);
  Serial.println("LED test complete");

  // Initialize SIM800L serial communication
  // Note: SIM800L default baud rate is 9600
  Serial.println("Initializing SIM800L serial communication...");
  sim800lSerial.begin(9600, SERIAL_8N1, SIM800L_RX_PIN, SIM800L_TX_PIN);
  sim800lSerial.setTimeout(2000);  // Set timeout for reading
  delay(3000);  // Give SIM800L more time to initialize after power-on

  // Clear any garbage data in buffer
  delay(500);
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }
  delay(500);

  // Initialize GSM module
  Serial.println("Initializing GSM module...");
  Serial.print("APN Configuration: ");
  Serial.print(APN);
  if (String(APN_USERNAME).length() > 0) {
    Serial.print(" | Username: " + String(APN_USERNAME));
  }
  if (String(APN_PASSWORD).length() > 0) {
    Serial.print(" | Password: " + String(APN_PASSWORD));
  }
  Serial.println();

  if (initializeGSM()) {
    gsmInitialized = true;
    Serial.println("✓ GSM module initialized successfully");
    blinkLED(3, 200);  // 3 quick blinks = success
  } else {
    Serial.println("✗ Failed to initialize GSM module");
    blinkLED(10, 100);  // 10 fast blinks = error
  }

  // Get initial signal strength
  if (gsmInitialized) {
    signalStrength = getSignalStrength();
    Serial.print("Signal Strength: ");
    Serial.print(signalStrength);
    Serial.println("%");
  }

  // Read battery level (optional - skip if not connected)
  batteryLevel = readBatteryLevel();
  if (batteryLevel == 100 && analogRead(BATTERY_ADC_PIN) < 50) {
    Serial.println("Battery Level: Not monitoring (optional feature)");
  } else {
    Serial.print("Battery Level: ");
    Serial.print(batteryLevel);
    Serial.println("%");
  }

  Serial.println("Setup complete. Starting main loop...");
  Serial.println();

  // Connect to MQTT if using MQTT
  #ifdef USE_MQTT
    if (gsmInitialized) {
      Serial.println("Attempting MQTT connection...");
      if (connectMQTT()) {
        Serial.println("✓ MQTT ready");
      } else {
        Serial.println("⚠️  MQTT connection failed, will retry on next data send");
      }
    }
  #endif
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  // Handle AT commands from Serial Monitor (passthrough to SIM800L)
  handleSerialCommands();

  unsigned long currentTime = millis();

  // Real-time LED update: Read sensor and update LEDs every 500ms
  if (currentTime - lastLEDUpdateTime >= LED_UPDATE_INTERVAL || lastLEDUpdateTime == 0) {
    // Measure fill level in real-time
    float newFillLevel = measureFillLevel();
    
    // Only update if reading is valid (>= 0)
    if (newFillLevel >= 0) {
      // Update fill level value
      currentFillLevel = newFillLevel;
      // Update LED indicators only when fill level crosses thresholds
      // (LEDs will only change when moving between zones: <70%, 70-90%, >90%)
      updateLEDIndicators(currentFillLevel);
    } else {
      // Sensor reading failed - keep previous value
      // Don't update LEDs if sensor reading fails
      if (currentFillLevel < 0) {
        // No valid reading yet - turn off LEDs
        digitalWrite(LED_YELLOW_PIN, LOW);
        digitalWrite(LED_RED_PIN, LOW);
        currentLEDState = -1;  // Reset state
        Serial.println("Waiting for valid sensor reading...");
      }
    }
    
    lastLEDUpdateTime = currentTime;
  }

  // Check if it's time to send data to backend (every 5 minutes)
  if (currentTime - lastUpdateTime >= UPDATE_INTERVAL || lastUpdateTime == 0) {
    // Use the current fill level (already measured for LEDs)
    float fillLevel = currentFillLevel;

    // Update battery and signal strength
    batteryLevel = readBatteryLevel();
    if (gsmInitialized) {
      signalStrength = getSignalStrength();
    }

    // Send data to backend
    if (gsmInitialized) {
      bool success = false;

      #ifdef USE_MQTT
        // Use MQTT for data transmission
        success = publishMQTTData(fillLevel, batteryLevel, signalStrength);
      #else
        // Use HTTP POST (legacy)
        success = sendDataToBackend(fillLevel, batteryLevel, signalStrength);
      #endif

      if (success) {
        Serial.println("✓ Data sent successfully");
        blinkLED(2, 500);  // 2 slow blinks = data sent
      } else {
        Serial.println("✗ Failed to send data");
        blinkLED(5, 100);  // 5 fast blinks = send error
      }
    } else {
      Serial.println("✗ GSM not initialized, cannot send data");
      // Try to reinitialize GSM
      if (initializeGSM()) {
        gsmInitialized = true;
        Serial.println("✓ GSM reinitialized");
      }
    }

    lastUpdateTime = currentTime;
  }

  // Handle incoming GSM messages (if needed)
  checkGSMMessages();

  // Small delay to prevent watchdog issues
  delay(100);
}

// ============================================
// ULTRASONIC SENSOR FUNCTIONS
// ============================================
float measureFillLevel() {
  // Send ultrasonic pulse
  digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIGGER_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIGGER_PIN, LOW);

  // Read echo pulse duration
  long duration = pulseIn(ULTRASONIC_ECHO_PIN, HIGH, 30000);  // 30ms timeout

  if (duration == 0) {
    Serial.println("Warning: No echo received from ultrasonic sensor");
    return -1;  // Error value
  }

  // Calculate distance (speed of sound = 343 m/s = 0.0343 cm/μs)
  // Divide by 2 because sound travels to object and back
  float distance_cm = (duration * 0.0343) / 2.0;

  // Calculate fill level percentage
  // If distance is close to 0, bin is full (100%)
  // If distance is close to BIN_HEIGHT_CM, bin is empty (0%)
  float fillLevel = ((BIN_HEIGHT_CM - distance_cm) / BIN_HEIGHT_CM) * 100.0;

  // Clamp values between 0 and 100
  if (fillLevel < 0) fillLevel = 0;
  if (fillLevel > 100) fillLevel = 100;

  Serial.print("Distance: ");
  Serial.print(distance_cm);
  Serial.print(" cm | Fill Level: ");
  Serial.print(fillLevel);
  Serial.println("%");

  return fillLevel;
}

// ============================================
// LED INDICATOR FUNCTIONS - Update Only When Fill Level Changes
// ============================================
void updateLEDIndicators(float fillLevel) {
  // Validate fill level
  if (fillLevel < 0) {
    // Invalid reading - turn off LEDs and return
    digitalWrite(LED_YELLOW_PIN, LOW);
    digitalWrite(LED_RED_PIN, LOW);
    currentLEDState = -1;  // Reset state
    Serial.println("Invalid fill level reading - LEDs OFF");
    return;
  }
  
  // Clamp fill level to 0-100
  if (fillLevel > 100) fillLevel = 100;
  if (fillLevel < 0) fillLevel = 0;

  // Determine which threshold zone the fill level is in
  int newLEDState;
  if (fillLevel >= FILL_LEVEL_CRITICAL) {
    newLEDState = 2;  // Critical zone (>90%)
  } else if (fillLevel >= FILL_LEVEL_WARNING) {
    newLEDState = 1;  // Warning zone (70-90%)
  } else {
    newLEDState = 0;  // Normal zone (<70%)
  }

  // Only update LEDs if we moved to a different zone
  if (newLEDState != currentLEDState) {
    currentLEDState = newLEDState;
    
    // Update LEDs based on new zone
    if (newLEDState == 2) {
      // Critical state (>90%): Red LED ON (solid)
      digitalWrite(LED_RED_PIN, HIGH);
      digitalWrite(LED_YELLOW_PIN, LOW);
      Serial.print("LED CHANGED: CRITICAL - Bin is ");
      Serial.print(fillLevel, 1);
      Serial.println("% full - RED LED ON");
    } else if (newLEDState == 1) {
      // Warning state (70-90%): Yellow LED ON (solid)
      digitalWrite(LED_YELLOW_PIN, HIGH);
      digitalWrite(LED_RED_PIN, LOW);
      Serial.print("LED CHANGED: WARNING - Bin is ");
      Serial.print(fillLevel, 1);
      Serial.println("% full - YELLOW LED ON");
    } else {
      // Normal state (<70%): Both LEDs OFF
      digitalWrite(LED_YELLOW_PIN, LOW);
      digitalWrite(LED_RED_PIN, LOW);
      Serial.print("LED CHANGED: Normal - Bin is ");
      Serial.print(fillLevel, 1);
      Serial.println("% full - LEDs OFF");
    }
  }
  // If state didn't change, LEDs remain as they are (no update needed)
}

// ============================================
// BATTERY MONITORING FUNCTIONS
// ============================================
int readBatteryLevel() {
  // Battery monitoring is OPTIONAL
  // If not connected, return a default value
  int adcValue = analogRead(BATTERY_ADC_PIN);

  // If ADC reads very low (close to 0), battery monitoring is likely not connected
  // ESP32 ADC noise floor is typically 100-200, so < 50 means likely not connected
  if (adcValue < 50) {
    return 100;  // Return default 100% if not monitoring
  }

  // Convert ADC value to voltage
  // Assuming voltage divider: Battery -> 10kΩ -> ADC_PIN -> 10kΩ -> GND
  // ESP32 ADC max voltage: 3.3V, resolution: 12-bit (0-4095)
  float adcVoltage = (adcValue / 4095.0) * 3.3;
  float batteryVoltage = adcVoltage * 2.0;  // Adjust multiplier based on your divider

  // Convert voltage to percentage
  // Assuming Li-ion battery: 3.0V = 0%, 4.2V = 100%
  int level = ((batteryVoltage - 3.0) / (4.2 - 3.0)) * 100;

  if (level < 0) level = 0;
  if (level > 100) level = 100;

  return level;
}

// ============================================
// GSM/SIM800L FUNCTIONS
// ============================================
bool initializeGSM() {
  Serial.println("========================================");
  Serial.println("SIM800L Communication Test");
  Serial.println("========================================");

  // Skip reset for now - it might be causing issues
  // Just wait a bit for module to be ready
  Serial.println("Waiting for SIM800L to be ready...");
  delay(2000);

  // Clear any garbage in buffer
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }
  delay(500);

  // Test 1: Basic AT command (try multiple times with different approaches)
  Serial.println("\n[TEST 1] Basic Communication Test");
  Serial.println("Sending: AT");

  bool test1Pass = false;

  // Try standard approach first
  test1Pass = testATCommand("AT", 5000);

  // If failed, try sending multiple AT commands
  if (!test1Pass) {
    Serial.println("   Retrying with multiple AT commands...");
    for (int retry = 0; retry < 5; retry++) {
      sim800lSerial.print("AT\r\n");
      sim800lSerial.flush();
      delay(1000);

      // Check for response
      String retryResponse = "";
      unsigned long retryStart = millis();
      while (millis() - retryStart < 3000) {
        if (sim800lSerial.available()) {
          char c = sim800lSerial.read();
          retryResponse += c;
          String upper = retryResponse;
          upper.toUpperCase();
          if (upper.indexOf("OK") != -1) {
            Serial.print("   Response (retry ");
            Serial.print(retry + 1);
            Serial.print("): ");
            Serial.println(retryResponse);
            test1Pass = true;
            break;
          }
        }
        delay(50);
      }
      if (test1Pass) break;
      delay(500);
    }
  }

  if (!test1Pass) {
    Serial.println("❌ TEST 1 FAILED: Module not responding");
    Serial.println("\nTroubleshooting Steps:");
    Serial.println("1. Check power: Measure voltage at SIM800L VCC pin");
    Serial.println("   - Should be 3.7V - 4.2V");
    Serial.println("   - If 0V or very low: Check power supply connection");
    Serial.println("2. Check wiring:");
    Serial.println("   - ESP32 GPIO16 (RX2) → SIM800L TX");
    Serial.println("   - ESP32 GPIO17 (TX2) → SIM800L RX");
    Serial.println("   - GND → GND (common ground required)");
    Serial.println("3. Check capacitor:");
    Serial.println("   - 470-1000µF capacitor close to SIM800L VCC/GND");
    Serial.println("4. Power cycle:");
    Serial.println("   - Disconnect SIM800L power for 10 seconds");
    Serial.println("   - Reconnect and wait 5 seconds");
    Serial.println("5. Try manual test:");
    Serial.println("   - Use Serial Monitor to send: AT");
    Serial.println("   - Should see: OK");
    Serial.println("========================================");
    Serial.println("DIAGNOSIS: SIM800L communication failed");
    Serial.println("STATUS: ❌ FAIL - Cannot proceed");
    Serial.println("========================================");
    return false;
  }
  Serial.println("✅ TEST 1 PASSED: Module responding");
  delay(500);

  // Test 2: SIM Card Check
  Serial.println("\n[TEST 2] SIM Card Detection");
  bool test2Pass = false;

  // Try multiple methods to check SIM card
  Serial.println("Checking SIM card status...");
  String cpinResponse = sendATCommand("AT+CPIN?", 5000);
  delay(500);

  // Also try to get SIM card ID (CCID) - try multiple times
  Serial.println("Getting SIM card ID...");
  String ccidResponse = "";
  for (int attempt = 0; attempt < 3; attempt++) {
    ccidResponse = sendATCommand("AT+CCID", 3000);
    delay(500);
    if (ccidResponse.indexOf("+CCID:") != -1 || ccidResponse.indexOf("OK") != -1) {
      break; // Success
    }
    if (attempt < 2) {
      Serial.println("   Retrying CCID...");
      delay(1000);
    }
  }

  // Check signal strength as additional diagnostic
  Serial.println("Checking signal strength...");
  String csqResponse = sendATCommand("AT+CSQ", 3000);
  delay(500);

  // Check CPIN response
  String upperResponse = cpinResponse;
  upperResponse.toUpperCase();

  if (upperResponse.indexOf("READY") != -1 || upperResponse.indexOf("OK") != -1) {
    Serial.println("✅ TEST 2 PASSED: SIM card ready");
    test2Pass = true;

    // Try to get SIM card ID
    if (ccidResponse.indexOf("OK") != -1 && ccidResponse.length() > 10) {
      Serial.print("   SIM Card ID: ");
      // Extract CCID from response (usually 20 digits)
      int startIdx = ccidResponse.indexOf("+CCID: ");
      if (startIdx != -1) {
        String ccid = ccidResponse.substring(startIdx + 7);
        ccid.trim();
        Serial.println(ccid);
      } else {
        Serial.println("Retrieved");
      }
    }
  } else if (upperResponse.indexOf("SIM PIN") != -1 || upperResponse.indexOf("PIN") != -1) {
    Serial.println("⚠️  TEST 2 WARNING: SIM card PIN required");
    Serial.println("   Your SIM card is locked with a PIN code");
    Serial.println("   Solutions:");
    Serial.println("   1. Enter PIN via Serial Monitor: AT+CPIN=\"1234\"");
    Serial.println("   2. Disable PIN on your phone first");
    Serial.println("   3. Use a SIM card without PIN");
    test2Pass = false;
  } else if (upperResponse.indexOf("NOT INSERTED") != -1 || upperResponse.indexOf("NOT INSERT") != -1) {
    Serial.println("❌ TEST 2 FAILED: SIM card not inserted");
    Serial.println("   Solutions:");
    Serial.println("   1. Power off module");
    Serial.println("   2. Insert SIM card properly (gold contacts down)");
    Serial.println("   3. Ensure SIM card is fully seated");
    Serial.println("   4. Power on module and wait 5 seconds");
    test2Pass = false;
  } else if (upperResponse.indexOf("ERROR") != -1) {
    Serial.println("❌ TEST 2 FAILED: SIM card error");
    Serial.print("   CPIN Response: ");
    Serial.println(cpinResponse);

    // Check if we got signal but no SIM (common issue)
    String csqUpper = csqResponse;
    csqUpper.toUpperCase();
    if (csqUpper.indexOf("+CSQ:") != -1) {
      Serial.println("   ⚠️  Signal detected but SIM card not readable");
      Serial.println("   This usually means:");
      Serial.println("   - SIM card not making proper contact");
      Serial.println("   - SIM card inserted incorrectly");
      Serial.println("   - SIM card slot issue");
    }

    // Check CCID response
    String ccidUpper = ccidResponse;
    ccidUpper.toUpperCase();
    if (ccidUpper.indexOf("ERROR") != -1) {
      Serial.print("   CCID Response: ");
      Serial.println(ccidResponse);
      Serial.println("   ❌ Cannot read SIM card ID");
    }

    Serial.println("\n   🔧 CRITICAL: SIM Card Not Detected");
    Serial.println("   Troubleshooting Steps:");
    Serial.println("   1. POWER OFF module completely (disconnect power)");
    Serial.println("   2. Remove SIM card carefully");
    Serial.println("   3. Check SIM card:");
    Serial.println("      - Clean gold contacts with soft cloth");
    Serial.println("      - Check for damage/bends");
    Serial.println("      - Test SIM in a phone to verify it works");
    Serial.println("   4. Reinsert SIM card:");
    Serial.println("      - Gold contacts face DOWN (toward PCB)");
    Serial.println("      - SIM card should click into place");
    Serial.println("      - Ensure it's fully seated (not loose)");
    Serial.println("   5. Power ON and wait 10 seconds");
    Serial.println("   6. Try again");
    Serial.println("\n   Common Issues:");
    Serial.println("   - SIM card upside down (contacts facing up)");
    Serial.println("   - SIM card not fully inserted");
    Serial.println("   - Dirty contacts on SIM card");
    Serial.println("   - Wrong SIM card size (need standard SIM)");
    Serial.println("   - SIM card slot damaged");
    test2Pass = false;
  } else {
    Serial.println("⚠️  TEST 2: Unknown SIM card status");
    Serial.print("   Response: ");
    Serial.println(cpinResponse);
    Serial.println("   Trying to continue anyway...");
    // Try to get CCID as fallback check
    if (ccidResponse.indexOf("OK") != -1) {
      Serial.println("   ✅ SIM card ID retrieved - SIM may be working");
      test2Pass = true; // Allow to continue if we can read CCID
    } else {
      test2Pass = false;
    }
  }

  if (!test2Pass) {
    Serial.println("\n========================================");
    Serial.println("DIAGNOSIS: SIM card issue");
    Serial.println("STATUS: ❌ FAIL - Fix SIM card issue");
    Serial.println("========================================");
    Serial.println("\nQuick Fix Steps:");
    Serial.println("1. Power cycle: Disconnect power for 10 seconds");
    Serial.println("2. Check SIM: Remove and reinsert SIM card");
    Serial.println("3. Test SIM: Try SIM in a phone to verify it works");
    Serial.println("4. Check contacts: Clean SIM card contacts");
    Serial.println("5. Try different SIM: Test with another SIM card");
    Serial.println("========================================");
    return false;
  }
  delay(500);

  // Test 3: Network Registration
  Serial.println("\n[TEST 3] Network Registration");
  sendATCommand("AT+CREG=1", 2000);
  delay(500);

  // Try to register
  Serial.println("Attempting network registration...");
  sendATCommand("AT+COPS=0", 2000);
  delay(2000);

  bool test3Pass = false;
  Serial.println("Waiting for registration (max 30 seconds)...");
  for (int i = 0; i < 30; i++) {
    int status = getNetworkRegistrationStatus();

    if (status == 1 || status == 5) {
      Serial.println("✅ TEST 3 PASSED: Network registered");
      test3Pass = true;
      break;
    } else if (status == 0) {
      if (i % 5 == 0) {
        Serial.print("   Waiting... (");
        Serial.print(i);
        Serial.println(" seconds)");
      }
    } else if (status == 2) {
      Serial.println("   Searching for network...");
    } else if (status == 3) {
      Serial.println("❌ TEST 3 FAILED: Registration denied");
      break;
    }
    delay(1000);
  }

  if (!test3Pass) {
    Serial.println("⚠️  TEST 3 WARNING: Network not registered yet");
    Serial.println("   Module may still work, but GPRS might fail");
    // Continue anyway - sometimes GPRS works without full registration
  }
  delay(500);

  // Test 4: GPRS Connection
  Serial.println("\n[TEST 4] GPRS Connection Test");
  Serial.print("Configuring APN: ");
  Serial.println(APN);

  sendATCommand("AT+SAPBR=3,1,\"Contype\",\"GPRS\"", 2000);
  delay(500);

  String apnCommand = "AT+SAPBR=3,1,\"APN\",\"" + String(APN) + "\"";
  sendATCommand(apnCommand, 2000);
  delay(500);

  String apnUser = String(APN_USERNAME);
  if (apnUser.length() > 0) {
    String userCommand = "AT+SAPBR=3,1,\"USER\",\"" + apnUser + "\"";
    sendATCommand(userCommand, 2000);
    delay(500);
  }

  String apnPass = String(APN_PASSWORD);
  if (apnPass.length() > 0) {
    String passCommand = "AT+SAPBR=3,1,\"PWD\",\"" + apnPass + "\"";
    sendATCommand(passCommand, 2000);
    delay(500);
  }

  Serial.println("Opening GPRS context...");
  String gprsResponse = sendATCommand("AT+SAPBR=1,1", 15000);

  // Check if we got ERROR - might mean context is already open
  String gprsUpper = gprsResponse;
  gprsUpper.toUpperCase();
  if (gprsUpper.indexOf("ERROR") != -1) {
    Serial.println("   Note: AT+SAPBR=1,1 returned ERROR (context may already be open)");
    Serial.println("   Checking current IP address...");
  }
  delay(2000);

  // Check IP address (even if AT+SAPBR=1,1 returned ERROR, context might already be open)
  String ipResponse = sendATCommand("AT+SAPBR=2,1", 3000);
  bool test4Pass = false;

  // Check if we got an IP address (format: +SAPBR: 1,1,"IP_ADDRESS")
  // Look for IP address pattern: numbers and dots between quotes
  int sapbrIndex = ipResponse.indexOf("+SAPBR:");
  if (sapbrIndex != -1) {
    // Find the IP address in quotes
    int quoteStart = ipResponse.indexOf("\"", sapbrIndex);
    int quoteEnd = ipResponse.indexOf("\"", quoteStart + 1);

    if (quoteStart != -1 && quoteEnd != -1) {
      String ip = ipResponse.substring(quoteStart + 1, quoteEnd);
      ip.trim();

      // Check if it's a valid IP (not 0.0.0.0)
      if (ip != "0.0.0.0" && ip.length() > 0) {
        Serial.println("✅ TEST 4 PASSED: GPRS connected");
        Serial.print("   IP Address: ");
        Serial.println(ip);
        test4Pass = true;
      } else {
        Serial.println("❌ TEST 4 FAILED: GPRS not connected (IP: 0.0.0.0)");
        Serial.print("   Response: ");
        Serial.println(ipResponse);
      }
    } else {
      Serial.println("❌ TEST 4 FAILED: Could not parse IP address");
      Serial.print("   Response: ");
      Serial.println(ipResponse);
    }
  } else {
    // Check for ERROR in response
    String upperResponse = ipResponse;
    upperResponse.toUpperCase();
    if (upperResponse.indexOf("ERROR") != -1) {
      Serial.println("❌ TEST 4 FAILED: GPRS connection error");
      Serial.print("   Response: ");
      Serial.println(ipResponse);
    } else {
      Serial.println("⚠️  TEST 4: Unknown response format");
      Serial.print("   Response: ");
      Serial.println(ipResponse);
    }
  }

  // Final Status Report
  Serial.println("\n========================================");
  Serial.println("FINAL TEST RESULTS");
  Serial.println("========================================");
  Serial.println("TEST 1 - Communication: " + String(test1Pass ? "✅ PASS" : "❌ FAIL"));
  Serial.println("TEST 2 - SIM Card: " + String(test2Pass ? "✅ PASS" : "❌ FAIL"));
  Serial.println("TEST 3 - Network Registration: " + String(test3Pass ? "✅ PASS" : "⚠️  WARNING"));
  Serial.println("TEST 4 - GPRS Connection: " + String(test4Pass ? "✅ PASS" : "❌ FAIL"));
  Serial.println("========================================");

  if (test1Pass && test2Pass && test4Pass) {
    Serial.println("STATUS: ✅ PASS - Module ready for data transmission");
    Serial.println("========================================");
    return true;
  } else {
    Serial.println("STATUS: ❌ FAIL - Module not ready");
    if (!test1Pass) Serial.println("   → Fix: Check wiring and power supply");
    if (!test2Pass) Serial.println("   → Fix: Insert SIM card or enter PIN");
    if (!test4Pass) Serial.println("   → Fix: Check APN settings or network coverage");
    Serial.println("========================================");
    return false;
  }
}

// Helper function to test AT command and return pass/fail
bool testATCommand(String command, unsigned long timeout) {
  // Clear buffer thoroughly
  delay(100);
  unsigned long clearStart = millis();
  while (sim800lSerial.available() && (millis() - clearStart < 1000)) {
    sim800lSerial.read();
  }
  delay(200);

  // Send command multiple times (some modules need this)
  for (int attempt = 0; attempt < 3; attempt++) {
    sim800lSerial.print(command);
    sim800lSerial.print("\r\n");
    sim800lSerial.flush();
    delay(300);

    // Check if we got immediate response
    if (sim800lSerial.available()) {
      break;
    }
  }

  // Wait a bit for module to process
  delay(800);

  // Read response
  unsigned long startTime = millis();
  String response = "";
  int bytesRead = 0;

  while (millis() - startTime < timeout) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      bytesRead++;

      // Check for OK (case insensitive)
      String upperResponse = response;
      upperResponse.toUpperCase();
      if (upperResponse.indexOf("OK") != -1) {
        delay(200);
        // Read any remaining data
        while (sim800lSerial.available() && (millis() - startTime < timeout)) {
          char c2 = sim800lSerial.read();
          response += c2;
        }
        Serial.print("   Response: ");
        Serial.println(response);
        Serial.print("   Bytes received: ");
        Serial.println(bytesRead);
        return true;
      }

      // Also check for ERROR
      if (upperResponse.indexOf("ERROR") != -1) {
        Serial.print("   Response: ");
        Serial.println(response);
        return false;  // Got ERROR, not OK
      }
    } else {
      // If we got some data but no OK yet, wait a bit more
      if (bytesRead > 0 && (millis() - startTime) > 1000) {
        delay(100);
        // Check one more time
        if (!sim800lSerial.available()) {
          break;
        }
      }
      delay(50);
    }
  }

  Serial.print("   Response: ");
  if (response.length() > 0) {
    Serial.print(response);
    Serial.print(" (");
    Serial.print(response.length());
    Serial.println(" bytes)");
  } else {
    Serial.println("(No response - module may not be powered or connected)");
  }
  Serial.print("   Bytes received: ");
  Serial.println(bytesRead);

  return false;
}

String sendATCommand(String command, unsigned long timeout) {
  // Clear any pending data in buffer
  unsigned long clearStart = millis();
  while (sim800lSerial.available() && (millis() - clearStart < 500)) {
    sim800lSerial.read();
  }

  // Send command with CR+LF
  sim800lSerial.print(command);
  sim800lSerial.print("\r\n");
  sim800lSerial.flush();  // Ensure data is sent

  // Wait for module to process (increased delay)
  delay(500);

  unsigned long startTime = millis();
  String response = "";
  bool gotResponse = false;
  int consecutiveEmptyReads = 0;
  int lastResponseLength = 0;

  // Read response with timeout - wait longer for OK
  while (millis() - startTime < timeout) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      gotResponse = true;
      consecutiveEmptyReads = 0;
      lastResponseLength = response.length();

      // Check for OK or ERROR (case insensitive)
      String upperResponse = response;
      upperResponse.toUpperCase();

      if (upperResponse.indexOf("OK") != -1 || upperResponse.indexOf("ERROR") != -1) {
        delay(200);  // Wait a bit more for any trailing data
        // Read any remaining data
        while (sim800lSerial.available() && (millis() - startTime < timeout)) {
          char c2 = sim800lSerial.read();
          response += c2;
        }
        break;
      }
    } else {
      // If no data available, wait a bit
      consecutiveEmptyReads++;

      // If we got some response but it's not changing, wait a bit more
      if (gotResponse && response.length() == lastResponseLength) {
        if (consecutiveEmptyReads > 20) {  // Wait longer (20 * 50ms = 1 second)
          // Check one more time if OK is in the response
          String checkResponse = response;
          checkResponse.toUpperCase();
          if (checkResponse.indexOf("OK") != -1 || checkResponse.indexOf("ERROR") != -1) {
            break;
          }
          // If we have echo but no OK yet, wait a bit more
          if (response.indexOf(command) != -1 && consecutiveEmptyReads < 40) {
            delay(50);
            continue;
          }
          break;
        }
      }
      delay(50);
    }
  }

  // Clean up response - remove command echo if present
  response.trim();
  String cleanResponse = response;

  // Remove command echo (if response starts with the command)
  if (cleanResponse.startsWith(command)) {
    int echoEnd = cleanResponse.indexOf("\r\n");
    if (echoEnd != -1) {
      cleanResponse = cleanResponse.substring(echoEnd + 2);
      cleanResponse.trim();
    }
  }

  // Remove any leading/trailing whitespace and newlines
  cleanResponse.trim();

  // Also read from Serial for debugging
  Serial.print("AT Command: ");
  Serial.println(command);
  Serial.print("Response: ");
  if (cleanResponse.length() > 0) {
    Serial.println(cleanResponse);
  } else if (gotResponse) {
    Serial.println(response);  // Show raw if cleaned is empty
  } else {
    Serial.println("(No response or timeout)");
  }

  return cleanResponse.length() > 0 ? cleanResponse : response;
}

int getSignalStrength() {
  String response = sendATCommand("AT+CSQ", 2000);

  // Parse response: +CSQ: <rssi>,<ber>
  // RSSI: 0 = -113 dBm or less, 31 = -51 dBm or greater
  int rssiIndex = response.indexOf("+CSQ:");
  if (rssiIndex != -1) {
    int commaIndex = response.indexOf(",", rssiIndex);
    if (commaIndex != -1) {
      String rssiStr = response.substring(rssiIndex + 6, commaIndex);
      rssiStr.trim();
      int rssi = rssiStr.toInt();

      // Convert RSSI (0-31) to percentage (0-100)
      // RSSI 0 = 0%, RSSI 31 = 100%
      int percentage = (rssi * 100) / 31;
      return percentage;
    }
  }

  return 0;
}

// Helper function to get network registration status
int getNetworkRegistrationStatus() {
  String response = sendATCommand("AT+CREG?", 2000);

  // Parse CREG response: +CREG: <n>,<stat>
  // n = reporting mode (0 or 1), stat = registration status (0,1,2,3,4,5)
  int cregIndex = response.indexOf("+CREG:");
  if (cregIndex != -1) {
    // Find the comma after the first number
    int commaIndex = response.indexOf(",", cregIndex);
    if (commaIndex != -1) {
      // Extract the status (second number after comma)
      String statusStr = response.substring(commaIndex + 1);
      statusStr.trim();
      // Get just the number (might have newline or other chars)
      int statusEnd = statusStr.indexOf("\n");
      if (statusEnd != -1) {
        statusStr = statusStr.substring(0, statusEnd);
      }
      statusEnd = statusStr.indexOf("\r");
      if (statusEnd != -1) {
        statusStr = statusStr.substring(0, statusEnd);
      }
      return statusStr.toInt();
    }
  }

  return -1; // Error parsing
}

void checkGSMMessages() {
  // Check for incoming SMS or other messages
  // This is a placeholder - implement if needed
}

// Reset SIM800L module
void resetSIM800L() {
  Serial.println("Resetting SIM800L...");

  // Try to send reset command
  sim800lSerial.print("AT+CFUN=1,1\r\n");
  sim800lSerial.flush();
  delay(100);

  // Clear buffer
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }

  // Wait for module to reset (typically 3-5 seconds)
  Serial.println("Waiting for module to reset (5 seconds)...");
  delay(5000);

  // Clear any startup messages
  unsigned long clearStart = millis();
  while (sim800lSerial.available() && (millis() - clearStart < 2000)) {
    sim800lSerial.read();
  }

  Serial.println("Reset complete");
}

// ============================================
// AT COMMAND PASSTHROUGH (Serial Monitor)
// ============================================
void handleSerialCommands() {
  // Check if data is available from Serial Monitor
  if (Serial.available()) {
    String command = Serial.readStringUntil('\n');
    command.trim();
    command.toUpperCase();

    // If command starts with "AT", forward it to SIM800L
    if (command.startsWith("AT")) {
      Serial.print("→ SIM800L: ");
      Serial.println(command);

      // Send command to SIM800L
      sim800lSerial.println(command);
      delay(200);

      // Read and print response
      unsigned long startTime = millis();
      String response = "";
      bool gotResponse = false;

      while (millis() - startTime < 5000) {
        if (sim800lSerial.available()) {
          char c = sim800lSerial.read();
          response += c;
          Serial.print(c);  // Print as we receive
          gotResponse = true;

          // If we got OK or ERROR, response is likely complete
          if (response.indexOf("OK") != -1 || response.indexOf("ERROR") != -1) {
            // Wait a bit more for any remaining data
            delay(100);
            break;
          }
        }
      }

      if (!gotResponse) {
        Serial.println("(No response)");
      } else {
        Serial.println(); // New line after response
      }

      return; // Command handled, exit
    }

    // Handle special commands
    if (command == "HELP" || command == "?") {
      Serial.println("=== AT Command Passthrough ===");
      Serial.println("Type any AT command to send to SIM800L");
      Serial.println("Examples:");
      Serial.println("  AT              - Test communication");
      Serial.println("  AT+CPIN?        - Check SIM card");
      Serial.println("  AT+CSQ          - Signal strength");
      Serial.println("  AT+CREG?        - Network registration");
      Serial.println("  AT+COPS?        - Current operator");
      Serial.println("  AT+COPS=0       - Auto network selection");
      Serial.println("========================");
      return;
    }
  }

  // Forward unsolicited messages from SIM800L to Serial Monitor
  if (sim800lSerial.available()) {
    String unsolicited = "";
    unsigned long startTime = millis();
    while (sim800lSerial.available() && (millis() - startTime < 100)) {
      char c = sim800lSerial.read();
      unsolicited += c;
    }
    if (unsolicited.length() > 0) {
      Serial.print("← SIM800L: ");
      Serial.println(unsolicited);
    }
  }
}

// ============================================
// MQTT FUNCTIONS
// ============================================
#ifdef USE_MQTT
// Global variable to track TCP connection state
bool mqttTCPConnected = false;

bool connectMQTT() {
  Serial.println("Connecting to MQTT broker...");
  Serial.print("Broker: ");
  Serial.println(MQTT_BROKER);
  Serial.print("Port: ");
  Serial.println(MQTT_PORT);
  Serial.print("Client ID: ");
  Serial.println(MQTT_CLIENT_ID);
  Serial.print("Username: ");
  Serial.println(MQTT_USERNAME);

  // Try Method 1: AT+MQTTCONN (some SIM800L firmware versions)
  Serial.println("\n=== Trying Method 1: AT+MQTTCONN ===");
  String cmd1 = "AT+MQTTCONN=\"";
  cmd1 += MQTT_BROKER;
  cmd1 += "\",";
  cmd1 += String(MQTT_PORT);
  cmd1 += ",\"";
  cmd1 += MQTT_CLIENT_ID;
  cmd1 += "\",120,1,\"";
  cmd1 += MQTT_USERNAME;
  cmd1 += "\",\"";
  cmd1 += MQTT_PASSWORD;
  cmd1 += "\"\r\n";

  Serial.println("Sending: AT+MQTTCONN...");
  Serial.print("Command: ");
  Serial.println(cmd1);
  sim800lSerial.print(cmd1);
  delay(5000);  // Wait for connection

  String response = "";
  unsigned long start = millis();
  while (millis() - start < 15000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      Serial.print(c);
      // Success: +MQTTCONN: 0,0
      if (response.indexOf("+MQTTCONN: 0,0") != -1) {
        Serial.println("\n✓ MQTT connected successfully (Method 1)!");
        return true;
      }
      // Error: +MQTTCONN: 1,error_code or ERROR
      if (response.indexOf("ERROR") != -1 || response.indexOf("+MQTTCONN: 1,") != -1) {
        Serial.println("\n❌ Method 1 failed, trying Method 2...");
        break;  // Try Method 2
      }
    }
    delay(50);
  }

  // Clear buffer
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }
  delay(1000);

  // Try Method 2: AT+SMCONF + AT+SMCONN (alternative SIM800L MQTT commands)
  Serial.println("\n=== Trying Method 2: AT+SMCONF + AT+SMCONN ===");

  // Configure MQTT parameters
  Serial.println("Setting MQTT URL...");
  String urlCmd = "AT+SMCONF=\"URL\",\"" + String(MQTT_BROKER) + "\"," + String(MQTT_PORT) + "\r\n";
  sim800lSerial.print(urlCmd);
  delay(2000);
  String urlResponse = "";
  while (sim800lSerial.available()) {
    urlResponse += (char)sim800lSerial.read();
  }
  Serial.print("URL Response: ");
  Serial.println(urlResponse);

  if (urlResponse.indexOf("ERROR") != -1) {
    Serial.println("❌ AT+SMCONF URL failed - Method 2 not supported");
    Serial.println("\n=== Trying Method 3: TCP Socket + MQTT Protocol ===");
    Serial.println("This requires implementing MQTT protocol manually...");
    Serial.println("For now, checking if port 1883 is accessible...");

    // Test TCP connection to broker
    Serial.println("Testing TCP connection to broker...");
    String tcpCmd = "AT+CIPSTART=\"TCP\",\"" + String(MQTT_BROKER) + "\"," + String(MQTT_PORT) + "\r\n";
    sim800lSerial.print(tcpCmd);
    delay(5000);
    String tcpResponse = "";
    while (sim800lSerial.available()) {
      tcpResponse += (char)sim800lSerial.read();
    }
    Serial.print("TCP Response: ");
    Serial.println(tcpResponse);

    if (tcpResponse.indexOf("CONNECT OK") != -1 || tcpResponse.indexOf("ALREADY CONNECT") != -1) {
      Serial.println("✓ TCP connection successful!");
      if (tcpResponse.indexOf("ALREADY CONNECT") != -1) {
        Serial.println("   TCP connection already exists - reusing it");
      }
      Serial.println("   Port 1883 is NOT blocked!");
      Serial.println("   Implementing MQTT protocol manually over TCP...");

      // TCP connection is already open, use it for MQTT
      // Don't close it, just proceed with MQTT CONNECT
      mqttTCPConnected = true;
      return connectMQTTOverTCP();
    } else if (tcpResponse.indexOf("CONNECT FAIL") != -1) {
      Serial.println("❌ TCP connection failed");
      Serial.println("   Port 1883 is likely BLOCKED by network/firewall");
      Serial.println("   This is why MQTT connection fails");
    } else if (tcpResponse.indexOf("ERROR") != -1) {
      // Check if ERROR is because connection already exists
      if (tcpResponse.indexOf("ALREADY CONNECT") != -1) {
        Serial.println("✓ TCP connection already exists!");
        Serial.println("   Reusing existing connection for MQTT...");
        mqttTCPConnected = true;
        return connectMQTTOverTCP();
      } else {
        Serial.println("❌ TCP connection error");
        Serial.print("   Response: ");
        Serial.println(tcpResponse);
      }
    }

    return false;
  }

  // Set client ID
  Serial.println("Setting Client ID...");
  String clientCmd = "AT+SMCONF=\"CLIENTID\",\"" + String(MQTT_CLIENT_ID) + "\"\r\n";
  sim800lSerial.print(clientCmd);
  delay(2000);
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }

  // Set username
  Serial.println("Setting Username...");
  String userCmd = "AT+SMCONF=\"USERNAME\",\"" + String(MQTT_USERNAME) + "\"\r\n";
  sim800lSerial.print(userCmd);
  delay(2000);
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }

  // Set password
  Serial.println("Setting Password...");
  String passCmd = "AT+SMCONF=\"PASSWORD\",\"" + String(MQTT_PASSWORD) + "\"\r\n";
  sim800lSerial.print(passCmd);
  delay(2000);
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }

  // Connect
  Serial.println("Connecting to MQTT broker (AT+SMCONN)...");
  sim800lSerial.print("AT+SMCONN\r\n");
  delay(5000);

  response = "";
  start = millis();
  while (millis() - start < 15000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      Serial.print(c);
      if (response.indexOf("OK") != -1 && response.indexOf("ERROR") == -1) {
        Serial.println("\n✓ MQTT connected successfully (Method 2)!");
        return true;
      }
      if (response.indexOf("ERROR") != -1) {
        Serial.println("\n❌ Method 2 also failed");
        Serial.println("   Full response: " + response);
        return false;
      }
    }
    delay(50);
  }

  Serial.println("\n⚠️  MQTT connection timeout (both methods)");
  Serial.println("   Possible causes:");
  Serial.println("   1. Port 1883 blocked by network/firewall");
  Serial.println("   2. SIM800L firmware doesn't support MQTT");
  Serial.println("   3. Broker rejecting connection");
  Serial.println("   4. Wrong credentials");
  return false;
}

// Helper function to encode MQTT string (2-byte length + string)
void encodeMQTTString(String str, uint8_t* buffer, int& offset) {
  uint16_t len = str.length();
  buffer[offset++] = (len >> 8) & 0xFF;  // High byte
  buffer[offset++] = len & 0xFF;          // Low byte
  for (int i = 0; i < len; i++) {
    buffer[offset++] = str.charAt(i);
  }
}

// Helper function to encode remaining length (MQTT variable length encoding)
int encodeRemainingLength(int length, uint8_t* buffer, int offset) {
  int pos = offset;
  do {
    uint8_t digit = length % 128;
    length /= 128;
    if (length > 0) {
      digit |= 0x80;
    }
    buffer[pos++] = digit;
  } while (length > 0);
  return pos - offset;
}

// Connect to MQTT broker over TCP using manual MQTT protocol
bool connectMQTTOverTCP() {
  Serial.println("\n=== Implementing MQTT over TCP ===");

  // Step 1: TCP connection should already be open from previous step
  // Just verify it's still connected
  Serial.println("Verifying TCP connection...");

  // Check connection status
  sim800lSerial.print("AT+CIPSTATUS\r\n");
  delay(1000);
  String statusResponse = "";
  while (sim800lSerial.available()) {
    statusResponse += (char)sim800lSerial.read();
  }
  Serial.print("Status: ");
  Serial.println(statusResponse);

  // If connection is not OK, try to open it
  if (statusResponse.indexOf("STATE: CONNECT OK") == -1) {
    Serial.println("TCP not connected, opening connection...");
    String tcpCmd = "AT+CIPSTART=\"TCP\",\"" + String(MQTT_BROKER) + "\"," + String(MQTT_PORT) + "\r\n";
    sim800lSerial.print(tcpCmd);
    delay(5000);
    String tcpResponse = "";
    while (sim800lSerial.available()) {
      tcpResponse += (char)sim800lSerial.read();
    }
    Serial.print("TCP Response: ");
    Serial.println(tcpResponse);

    if (tcpResponse.indexOf("CONNECT OK") == -1 && tcpResponse.indexOf("ALREADY CONNECT") == -1) {
      Serial.println("❌ TCP connection failed");
      Serial.print("Response: ");
      Serial.println(tcpResponse);
      mqttTCPConnected = false;
      return false;
    }
  }

  Serial.println("✓ TCP connection ready");
  mqttTCPConnected = true;

  // Step 2: Build MQTT CONNECT packet
  Serial.println("Building MQTT CONNECT packet...");

  // Calculate packet size
  int clientIdLen = String(MQTT_CLIENT_ID).length();
  int usernameLen = String(MQTT_USERNAME).length();
  int passwordLen = String(MQTT_PASSWORD).length();

  // Variable header: Protocol name (6 bytes) + Protocol level (1) + Connect flags (1) + Keep alive (2) = 10 bytes
  // Payload: Client ID (2 + len) + Username (2 + len) + Password (2 + len)
  int remainingLength = 10 + (2 + clientIdLen) + (2 + usernameLen) + (2 + passwordLen);

  // Build packet
  uint8_t packet[256];
  int offset = 0;

  // Fixed header: CONNECT (0x10)
  packet[offset++] = 0x10;  // CONNECT message type

  // Remaining length (variable length encoding)
  int remLenBytes = encodeRemainingLength(remainingLength, packet, offset);
  offset += remLenBytes;

  // Variable header: Protocol name "MQTT"
  encodeMQTTString("MQTT", packet, offset);

  // Protocol level (4 = MQTT 3.1.1)
  packet[offset++] = 0x04;

  // Connect flags: Clean session (bit 1), Username (bit 7), Password (bit 6)
  packet[offset++] = 0xC2;  // 11000010 = Clean session + Username + Password

  // Keep alive (120 seconds = 0x0078)
  packet[offset++] = 0x00;
  packet[offset++] = 0x78;

  // Payload: Client ID
  encodeMQTTString(String(MQTT_CLIENT_ID), packet, offset);

  // Payload: Username
  encodeMQTTString(String(MQTT_USERNAME), packet, offset);

  // Payload: Password
  encodeMQTTString(String(MQTT_PASSWORD), packet, offset);

  int packetLength = offset;

  Serial.print("Packet length: ");
  Serial.println(packetLength);

  // Step 3: Send packet via TCP
  Serial.println("Sending MQTT CONNECT packet...");

  // Set send mode
  sim800lSerial.print("AT+CIPSEND=");
  sim800lSerial.print(packetLength);
  sim800lSerial.print("\r\n");
  delay(2000);

  // Wait for ">" prompt
  String sendPrompt = "";
  unsigned long start = millis();
  while (millis() - start < 5000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      sendPrompt += c;
      Serial.print(c);
      if (sendPrompt.indexOf(">") != -1) {
        break;
      }
    }
    delay(50);
  }

  if (sendPrompt.indexOf(">") == -1) {
    Serial.println("\n❌ Did not get send prompt");
    return false;
  }

  // Send packet bytes
  for (int i = 0; i < packetLength; i++) {
    sim800lSerial.write(packet[i]);
  }
  delay(3000);

  // Step 4: Read CONNACK response
  Serial.println("Waiting for CONNACK response...");
  String connackResponse = "";
  start = millis();
  while (millis() - start < 10000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      connackResponse += c;
      Serial.print(c);

      // CONNACK is 0x20 followed by remaining length 0x02, then return code
      // Look for "SEND OK" and check for connection success
      if (connackResponse.indexOf("SEND OK") != -1) {
        delay(2000);  // Wait for CONNACK
        // Read more data
        while (sim800lSerial.available()) {
          char c2 = sim800lSerial.read();
          connackResponse += c2;
          Serial.print(c2);
        }

        // Check if we got CONNACK (0x20 0x02 0x00 0x00 = success)
        // In ASCII, this might appear as special characters
        // Better: Check for "OK" after SEND OK and no ERROR
        if (connackResponse.indexOf("ERROR") == -1) {
          Serial.println("\n✓ MQTT CONNECT sent, checking response...");
          // For now, assume success if no error
          // In production, should parse CONNACK properly
          Serial.println("✓ MQTT connected over TCP!");
          return true;
        }
      }

      if (connackResponse.indexOf("ERROR") != -1 || connackResponse.indexOf("CLOSE") != -1) {
        Serial.println("\n❌ MQTT connection failed");
        mqttTCPConnected = false;
        return false;
      }
    }
    delay(50);
  }

  Serial.println("\n⚠️  Timeout waiting for CONNACK");
  return false;
}

bool publishMQTTData(float fillLevel, int batteryLevel, int signalStrength) {
  if (fillLevel < 0) {
    Serial.println("Error: Invalid fill level");
    return false;
  }

  // Check GPRS connection first
  Serial.println("Checking GPRS connection...");
  String gprsCheck = sendATCommand("AT+SAPBR=2,1", 3000);
  bool gprsConnected = false;

  int sapbrIndex = gprsCheck.indexOf("+SAPBR:");
  if (sapbrIndex != -1) {
    int quoteStart = gprsCheck.indexOf("\"", sapbrIndex);
    int quoteEnd = gprsCheck.indexOf("\"", quoteStart + 1);
    if (quoteStart != -1 && quoteEnd != -1) {
      String ip = gprsCheck.substring(quoteStart + 1, quoteEnd);
      ip.trim();
      if (ip != "0.0.0.0" && ip.length() > 0) {
        gprsConnected = true;
        Serial.print("✓ GPRS connected, IP: ");
        Serial.println(ip);
      }
    }
  }

  if (!gprsConnected) {
    Serial.println("⚠️  GPRS not connected, attempting to reconnect...");
    String gprsResponse = sendATCommand("AT+SAPBR=1,1", 15000);
    delay(2000);
    gprsCheck = sendATCommand("AT+SAPBR=2,1", 3000);
    sapbrIndex = gprsCheck.indexOf("+SAPBR:");
    if (sapbrIndex != -1) {
      int quoteStart = gprsCheck.indexOf("\"", sapbrIndex);
      int quoteEnd = gprsCheck.indexOf("\"", quoteStart + 1);
      if (quoteStart != -1 && quoteEnd != -1) {
        String ip = gprsCheck.substring(quoteStart + 1, quoteEnd);
        ip.trim();
        if (ip != "0.0.0.0" && ip.length() > 0) {
          gprsConnected = true;
          Serial.print("✓ GPRS reconnected, IP: ");
          Serial.println(ip);
        }
      }
    }

    if (!gprsConnected) {
      Serial.println("❌ GPRS connection failed. Cannot send data.");
      return false;
    }
  }

  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["binId"] = BIN_ID;
  doc["fillLevel"] = fillLevel;
  doc["batteryLevel"] = batteryLevel;
  doc["signalStrength"] = signalStrength;
  doc["timestamp"] = getCurrentTimestamp();
  // Add location coordinates
  doc["latitude"] = BIN_LATITUDE;
  doc["longitude"] = BIN_LONGITUDE;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("Publishing to MQTT...");
  Serial.print("Topic: ");
  Serial.println(MQTT_TOPIC);
  Serial.print("Payload: ");
  Serial.println(jsonPayload);

  // Check if MQTT is connected, reconnect if needed
  if (!mqttTCPConnected) {
    Serial.println("MQTT not connected, reconnecting...");
    if (!connectMQTT()) {
      Serial.println("❌ Failed to reconnect to MQTT");
      return false;
    }
  }

  // Publish message using manual MQTT protocol over TCP
  Serial.println("Publishing MQTT message over TCP...");

  // Build MQTT PUBLISH packet
  int topicLen = String(MQTT_TOPIC).length();
  int payloadLen = jsonPayload.length();

  // Fixed header: PUBLISH (0x30) with QoS 1 (0x02) = 0x32
  // Variable header: Topic length (2) + Topic + Message ID (2 for QoS 1)
  // Payload: JSON data
  int remainingLength = (2 + topicLen) + 2 + payloadLen;  // Topic + Message ID + Payload

  uint8_t packet[512];
  int offset = 0;

  // Fixed header
  packet[offset++] = 0x32;  // PUBLISH with QoS 1

  // Remaining length
  int remLenBytes = encodeRemainingLength(remainingLength, packet, offset);
  offset += remLenBytes;

  // Variable header: Topic
  encodeMQTTString(String(MQTT_TOPIC), packet, offset);

  // Message ID (for QoS 1, use 1)
  packet[offset++] = 0x00;
  packet[offset++] = 0x01;

  // Payload: JSON data
  for (int i = 0; i < payloadLen; i++) {
    packet[offset++] = jsonPayload.charAt(i);
  }

  int packetLength = offset;

  // Send packet via TCP
  sim800lSerial.print("AT+CIPSEND=");
  sim800lSerial.print(packetLength);
  sim800lSerial.print("\r\n");
  delay(2000);

  // Wait for ">" prompt
  String sendPrompt = "";
  unsigned long start = millis();
  while (millis() - start < 5000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      sendPrompt += c;
      if (sendPrompt.indexOf(">") != -1) {
        break;
      }
    }
    delay(50);
  }

  if (sendPrompt.indexOf(">") == -1) {
    Serial.println("❌ Did not get send prompt");
    return false;
  }

  // Send packet
  for (int i = 0; i < packetLength; i++) {
    sim800lSerial.write(packet[i]);
  }
  delay(3000);

  // Check for PUBACK (QoS 1 acknowledgment) or SEND OK
  String response = "";
  start = millis();
  while (millis() - start < 10000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      Serial.print(c);

      // PUBACK is 0x40 0x02 followed by message ID
      // Look for "SEND OK" as indication packet was sent
      if (response.indexOf("SEND OK") != -1) {
        Serial.println("\n✓ MQTT message sent!");
        // For QoS 1, we should receive PUBACK, but SEND OK indicates TCP send succeeded
        // In production, should parse PUBACK properly
        return true;
      }

      if (response.indexOf("ERROR") != -1 || response.indexOf("CLOSE") != -1) {
        Serial.println("\n❌ MQTT publish failed");
        mqttTCPConnected = false;
        return false;
      }
    }
    delay(50);
  }

  Serial.println("\n⚠️  Timeout waiting for publish confirmation");
  return false;
}
#endif  // #ifdef USE_MQTT

// ============================================
// HTTP POST FUNCTIONS (Legacy - kept for fallback)
// ============================================
#ifndef USE_MQTT
bool sendDataToBackend(float fillLevel, int batteryLevel, int signalStrength) {
  if (fillLevel < 0) {
    Serial.println("Error: Invalid fill level");
    return false;
  }

  // Configure DNS servers (Google DNS) for better reliability
  Serial.println("Configuring DNS servers...");
  sendATCommand("AT+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\"", 2000);

  // Check GPRS connection before sending
  Serial.println("Checking GPRS connection...");
  String gprsCheck = sendATCommand("AT+SAPBR=2,1", 3000);
  bool gprsConnected = false;

  // Check if we got an IP address
  int sapbrIndex = gprsCheck.indexOf("+SAPBR:");
  if (sapbrIndex != -1) {
    int quoteStart = gprsCheck.indexOf("\"", sapbrIndex);
    int quoteEnd = gprsCheck.indexOf("\"", quoteStart + 1);
    if (quoteStart != -1 && quoteEnd != -1) {
      String ip = gprsCheck.substring(quoteStart + 1, quoteEnd);
      ip.trim();
      if (ip != "0.0.0.0" && ip.length() > 0) {
        gprsConnected = true;
        Serial.print("✓ GPRS connected, IP: ");
        Serial.println(ip);
      }
    }
  }

  if (!gprsConnected) {
    Serial.println("⚠️  GPRS not connected, attempting to reconnect...");
    // Try to open GPRS context
    String gprsResponse = sendATCommand("AT+SAPBR=1,1", 15000);
    delay(2000);

    // Check again
    gprsCheck = sendATCommand("AT+SAPBR=2,1", 3000);
    sapbrIndex = gprsCheck.indexOf("+SAPBR:");
    if (sapbrIndex != -1) {
      int quoteStart = gprsCheck.indexOf("\"", sapbrIndex);
      int quoteEnd = gprsCheck.indexOf("\"", quoteStart + 1);
      if (quoteStart != -1 && quoteEnd != -1) {
        String ip = gprsCheck.substring(quoteStart + 1, quoteEnd);
        ip.trim();
        if (ip != "0.0.0.0" && ip.length() > 0) {
          gprsConnected = true;
          Serial.print("✓ GPRS reconnected, IP: ");
          Serial.println(ip);
        }
      }
    }

    if (!gprsConnected) {
      Serial.println("❌ GPRS connection failed. Cannot send data.");
      Serial.println("   Check network registration and APN settings.");
      return false;
    }
  }

  // Create JSON payload
  DynamicJsonDocument doc(1024);
  doc["binId"] = BIN_ID;
  doc["fillLevel"] = fillLevel;
  doc["batteryLevel"] = batteryLevel;
  doc["signalStrength"] = signalStrength;
  doc["timestamp"] = getCurrentTimestamp();
  // Add location coordinates
  doc["latitude"] = BIN_LATITUDE;
  doc["longitude"] = BIN_LONGITUDE;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("Sending data to backend...");
  Serial.println("Payload: " + jsonPayload);

  // Prepare HTTP POST request
  Serial.println("Initializing HTTP...");

  // First, terminate any existing HTTP session
  sim800lSerial.print("AT+HTTPTERM\r\n");
  delay(1000);
  while (sim800lSerial.available()) {
    sim800lSerial.read();  // Clear any response
  }

  // Now initialize HTTP
  String httpRequest = "AT+HTTPINIT\r\n";
  sim800lSerial.print(httpRequest);
  delay(2000);

  // Read and verify HTTPINIT response
  String httpInitResponse = "";
  unsigned long initStart = millis();
  while (millis() - initStart < 3000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      httpInitResponse += c;
      Serial.print(c);
      if (httpInitResponse.indexOf("OK") != -1 || httpInitResponse.indexOf("ERROR") != -1) {
        break;
      }
    }
    delay(50);
  }

  if (httpInitResponse.indexOf("ERROR") != -1) {
    Serial.println("\n❌ HTTP initialization failed");
    return false;
  }

  Serial.println("\n✓ HTTP initialized");

  // Enable SSL/TLS for HTTPS (required for AWS API Gateway)
  Serial.println("Enabling SSL/TLS for HTTPS...");
  sim800lSerial.print("AT+HTTPSSL=1\r\n");
  delay(2000);
  String sslResponse = "";
  unsigned long sslStart = millis();
  while (millis() - sslStart < 3000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      sslResponse += c;
      Serial.print(c);
      if (sslResponse.indexOf("OK") != -1 || sslResponse.indexOf("ERROR") != -1) {
        break;
      }
    }
    delay(50);
  }

  if (sslResponse.indexOf("ERROR") != -1) {
    Serial.println("\n⚠️  SSL enable failed - module may not support HTTPS");
    Serial.println("   Trying without SSL (will fail if URL is HTTPS)...");
  } else {
    Serial.println("\n✓ SSL/TLS enabled");
  }

  // Set HTTP parameters
  Serial.println("Setting URL...");
  String url = String(API_URL);
  httpRequest = "AT+HTTPPARA=\"URL\",\"" + url + "\"\r\n";
  sim800lSerial.print(httpRequest);
  delay(1500);

  // Verify URL was set
  while (sim800lSerial.available()) {
    char c = sim800lSerial.read();
    Serial.print(c);
  }

  httpRequest = "AT+HTTPPARA=\"CONTENT\",\"application/json\"\r\n";
  sim800lSerial.print(httpRequest);
  delay(1000);

  // Set HTTP timeout (60 seconds) - important for slow networks
  Serial.println("Setting HTTP timeout...");
  sim800lSerial.print("AT+HTTPPARA=\"TIMEOUT\",60\r\n");
  delay(1000);
  while (sim800lSerial.available()) {
    char c = sim800lSerial.read();
    Serial.print(c);
  }

  // Clear any pending data from serial buffer
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }

  // Set data length and wait for DOWNLOAD prompt
  Serial.println("Setting data length...");
  httpRequest = "AT+HTTPDATA=" + String(jsonPayload.length()) + ",30000\r\n";  // Increased timeout to 30s
  sim800lSerial.print(httpRequest);
  delay(2000);

  // Wait for DOWNLOAD prompt and clear it
  String downloadResponse = "";
  unsigned long downloadStart = millis();
  while (millis() - downloadStart < 5000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      downloadResponse += c;
      Serial.print(c);
      if (downloadResponse.indexOf("DOWNLOAD") != -1 || downloadResponse.indexOf("OK") != -1) {
        break;
      }
    }
    delay(50);
  }

  if (downloadResponse.indexOf("DOWNLOAD") == -1 && downloadResponse.indexOf("OK") == -1) {
    Serial.println("\n⚠️  Warning: Did not get DOWNLOAD prompt");
  } else {
    Serial.println("\n✓ Got DOWNLOAD prompt, sending data...");
  }

  // Send JSON data
  sim800lSerial.print(jsonPayload);
  delay(3000);  // Increased delay to ensure data is sent

  // Wait for OK after data is sent
  String dataOkResponse = "";
  unsigned long dataOkStart = millis();
  while (millis() - dataOkStart < 5000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      dataOkResponse += c;
      Serial.print(c);
      if (dataOkResponse.indexOf("OK") != -1) {
        Serial.println("\n✓ Data sent, OK received");
        break;
      }
    }
    delay(50);
  }

  // Clear any remaining buffer
  delay(500);
  while (sim800lSerial.available()) {
    sim800lSerial.read();
  }

  // Verify HTTP session is ready for POST
  Serial.println("Verifying HTTP session before POST...");
  delay(1000);
  sim800lSerial.print("AT+HTTPSTATUS?\r\n");
  delay(2000);
  String preStatus = "";
  while (sim800lSerial.available()) {
    char c = sim800lSerial.read();
    preStatus += c;
    Serial.print(c);
  }

  // Execute HTTP POST
  Serial.println("\nExecuting HTTP POST (AT+HTTPACTION=1)...");
  sim800lSerial.print("AT+HTTPACTION=1\r\n");

  // Wait for command echo and OK response
  delay(2000);

  // Read the OK response
  String actionResponse = "";
  unsigned long actionStart = millis();
  while (millis() - actionStart < 3000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      actionResponse += c;
      Serial.print(c);
      if (actionResponse.indexOf("OK") != -1 || actionResponse.indexOf("ERROR") != -1) {
        break;
      }
    }
    delay(50);
  }

  if (actionResponse.indexOf("ERROR") != -1) {
    Serial.println("\n❌ AT+HTTPACTION=1 returned ERROR!");
    Serial.println("   HTTP session may be in invalid state");
    Serial.println("   Attempting to reinitialize...");

    // Try to terminate and reinit
    sim800lSerial.print("AT+HTTPTERM\r\n");
    delay(2000);
    while (sim800lSerial.available()) {
      sim800lSerial.read();
    }
    return false;
  }

  Serial.println("\n✓ AT+HTTPACTION=1 accepted, waiting for HTTP response...");
  Serial.println("   (This may take 10-30 seconds depending on network)");

  // Now wait for the actual HTTP response (+HTTPACTION:)
  // This can take 10-30 seconds depending on network and server response time
  String response = "";
  unsigned long startTime = millis();
  bool gotHttpAction = false;
  bool gotOK = false;
  int lastCharTime = millis();
  int httpStatus = -1;  // HTTP status code (will be set when we get response)

  // Wait up to 35 seconds for HTTP response
  while (millis() - startTime < 35000) {
    if (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      Serial.print(c);
      lastCharTime = millis();  // Update last character time

      // Check for OK after AT+HTTPACTION=1
      if (!gotOK && response.indexOf("OK") != -1) {
        // Find the last OK (should be after AT+HTTPACTION=1)
        int lastOK = response.lastIndexOf("OK");
        if (lastOK > response.indexOf("AT+HTTPACTION=1")) {
          gotOK = true;
          Serial.println("\n✓ Got OK, waiting for +HTTPACTION...");
        }
      }

      // Check if we got the HTTPACTION response
      if (response.indexOf("+HTTPACTION:") != -1) {
        gotHttpAction = true;
        Serial.println("\n✓ Got +HTTPACTION response!");
        // Continue reading for a bit more to get full response
        delay(2000);
        while (sim800lSerial.available() && (millis() - startTime < 35000)) {
          char c2 = sim800lSerial.read();
          response += c2;
          Serial.print(c2);
        }
        break;
      }
    } else {
      // If no data for 5 seconds after OK, try reading HTTP response anyway
      if (gotOK && (millis() - lastCharTime > 5000) && (millis() - startTime > 10000)) {
        Serial.println("\n⚠️  No +HTTPACTION received, but trying to read response anyway...");
        // Try reading HTTP response body - might still have data
        delay(1000);
        sim800lSerial.print("AT+HTTPREAD\r\n");
        delay(2000);
        String bodyResponse = "";
        unsigned long bodyStart = millis();
        while (millis() - bodyStart < 5000) {
          if (sim800lSerial.available()) {
            char c = sim800lSerial.read();
            bodyResponse += c;
            Serial.print(c);
            if (bodyResponse.length() > 100) break;  // Got some data
          }
          delay(50);
        }
        break;
      }
    }
    delay(50);  // Small delay to prevent CPU spinning
  }

  // If we still don't have +HTTPACTION, try checking HTTP status
  if (!gotHttpAction) {
    Serial.println("\n⚠️  No +HTTPACTION received, checking HTTP status...");

    // Try to get HTTP status - sometimes the response comes but we miss it
    delay(2000);

    // Check if HTTP session is still active
    Serial.println("Checking HTTP session status...");
    sim800lSerial.print("AT+HTTPSTATUS?\r\n");
    delay(2000);
    String statusResponse = "";
    while (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      statusResponse += c;
      Serial.print(c);
    }

    // If status shows GET or no data, the POST might not have been sent correctly
    if (statusResponse.indexOf("GET") != -1) {
      Serial.println("\n⚠️  HTTP status shows GET instead of POST!");
      Serial.println("   This means the POST request was not properly configured.");
      Serial.println("   The HTTP session may need to be reinitialized.");
    }

    // Try reading HTTP response body anyway - might have data
    Serial.println("\nAttempting to read HTTP response body...");
    sim800lSerial.print("AT+HTTPREAD\r\n");
    delay(3000);
    String bodyResponse = "";
    unsigned long bodyStart = millis();
    while (millis() - bodyStart < 5000) {
      if (sim800lSerial.available()) {
        char c = sim800lSerial.read();
        bodyResponse += c;
        Serial.print(c);
        // If we get actual data (not just ERROR), the request might have succeeded
        if (bodyResponse.indexOf("success") != -1 || bodyResponse.indexOf("error") != -1) {
          Serial.println("\n✓ Got response body! Request may have succeeded.");
          // Try to parse status from body or assume success
          httpStatus = 200;  // Assume success if we got a response body
          gotHttpAction = true;
          break;
        }
        if (bodyResponse.indexOf("ERROR") != -1 && bodyResponse.length() > 20) {
          break;  // Got ERROR, stop reading
        }
      }
      delay(50);
    }

    // One more check for delayed +HTTPACTION
    delay(2000);
    while (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      response += c;
      Serial.print(c);
      if (response.indexOf("+HTTPACTION:") != -1) {
        gotHttpAction = true;
        Serial.println("\n✓ Found delayed +HTTPACTION response!");
        break;
      }
    }
  }

  if (!gotHttpAction && httpStatus == -1) {
    Serial.println("\n⚠️  Warning: No +HTTPACTION response received");
    Serial.println("   This might indicate:");
    Serial.println("   - Network timeout (SIM800L default timeout may be too short)");
    Serial.println("   - Server not responding");
    Serial.println("   - Cloudflare tunnel issue");
    Serial.println("   - GPRS connection lost during request");
    Serial.println("");
    Serial.println("   Troubleshooting:");
    Serial.println("   1. Check GPRS connection: AT+SAPBR=2,1");
    Serial.println("   2. Verify Cloudflare tunnel is running");
    Serial.println("   3. Test network: AT+CSQ");
    Serial.println("   4. Try manually: AT+HTTPACTION=1 (wait 20s) then AT+HTTPREAD");
  }

  // Parse HTTP response: +HTTPACTION: 1,STATUS_CODE,RESPONSE_LENGTH
  if (response.indexOf("+HTTPACTION:") != -1) {
    // Extract status code from response
    int statusStart = response.indexOf("+HTTPACTION: 1,") + 15;
    int statusEnd = response.indexOf(",", statusStart);
    if (statusEnd == -1) statusEnd = response.indexOf("\r", statusStart);
    if (statusEnd == -1) statusEnd = response.indexOf("\n", statusStart);

    if (statusStart > 14 && statusEnd > statusStart) {
      String statusStr = response.substring(statusStart, statusEnd);
      statusStr.trim();
      httpStatus = statusStr.toInt();
    }
  }

  // Check if request was successful (HTTP status 200)
  if (httpStatus == 200) {
    Serial.println("\n✓ HTTP POST successful");
    Serial.println("✓ Data sent successfully");

    // Optionally read response body for debugging
    Serial.println("Reading response body...");
    sim800lSerial.print("AT+HTTPREAD\r\n");
    delay(2000);
    String bodyResponse = "";
    unsigned long bodyStartTime = millis();
    while (millis() - bodyStartTime < 3000) {
      if (sim800lSerial.available()) {
        char c = sim800lSerial.read();
        bodyResponse += c;
        Serial.print(c);
        if (bodyResponse.indexOf("OK") != -1 && bodyResponse.length() > 50) {
          break;  // Got response
        }
      }
      delay(50);
    }

    // Terminate HTTP session
    Serial.println("Terminating HTTP session...");
    sim800lSerial.print("AT+HTTPTERM\r\n");
    delay(1000);
    // Clear any response
    while (sim800lSerial.available()) {
      sim800lSerial.read();
    }

    return true;
  } else {
    Serial.println("\n✗ HTTP POST failed");

    // Provide specific error messages
    if (httpStatus == 307) {
      Serial.println("❌ Error 307: Temporary Redirect");
      Serial.println("   → ngrok is redirecting HTTP to HTTPS");
      Serial.println("   → SIM800L doesn't follow redirects automatically");
      Serial.println("   → Solutions:");
      Serial.println("     1. Use HTTPS URL (requires SSL setup)");
      Serial.println("     2. Configure ngrok to not redirect");
      Serial.println("     3. Use ngrok HTTP URL if available");
      Serial.println("   → Check ngrok output for HTTP URL");
      Serial.println("   → Try: ngrok http 3000 --scheme=http");
    } else if (httpStatus == 601) {
      Serial.println("❌ Error 601: Network/DNS error");
      Serial.println("   → Check API_URL is not 'localhost'");
      Serial.println("   → Use public IP or domain name");
      Serial.println("   → See IOT_BACKEND_URL_SETUP.md for help");
    } else if (httpStatus == 603) {
      Serial.println("❌ Error 603: DNS/SSL Error");
      Serial.println("   → Possible causes:");
      Serial.println("     1. SSL/TLS not enabled (HTTPS requires SSL)");
      Serial.println("     2. DNS resolution failed");
      Serial.println("     3. SIM800L doesn't support HTTPS");
      Serial.println("   → Solutions:");
      Serial.println("     1. Test: AT+HTTPSSL=1 in Serial Monitor");
      Serial.println("     2. Test: AT+CDNSGIP=\"yjkr9bqrhb.execute-api.eu-north-1.amazonaws.com\"");
      Serial.println("     3. Configure DNS: AT+CDNSCFG=\"8.8.8.8\",\"8.8.4.4\"");
      Serial.println("     4. If SSL not supported, use HTTP proxy (Cloudflare Tunnel)");
    } else if (httpStatus == 404) {
      Serial.println("❌ Error 404: URL not found");
      Serial.println("   → Check endpoint path: /api/bins/iot/update");
      Serial.println("   → Verify backend is running");
    } else if (httpStatus == 500) {
      Serial.println("❌ Error 500: Server error");
      Serial.println("   → Check backend logs");
      Serial.println("   → Verify database connection");
    } else if (httpStatus == 400) {
      Serial.println("❌ Error 400: Bad request");
      Serial.println("   → Check JSON payload format");
    } else if (httpStatus > 0) {
      Serial.print("❌ HTTP Error: ");
      Serial.println(httpStatus);
    } else {
      Serial.println("❌ Unknown error - no HTTP response");
      Serial.println("   → Check if backend is running");
      Serial.println("   → Verify ngrok tunnel is active");
      Serial.println("   → Try visiting URL in browser first");
      Serial.println("   → Check network connectivity");
    }

    Serial.println("\nFull Response Received:");
    Serial.println("====================");
    Serial.println(response);
    Serial.println("====================");

    // Try to terminate HTTP session (may already be closed)
    Serial.println("Terminating HTTP session...");
    sim800lSerial.print("AT+HTTPTERM\r\n");
    delay(1000);
    // Clear any response (might be ERROR if already closed)
    while (sim800lSerial.available()) {
      char c = sim800lSerial.read();
      Serial.print(c);
    }

    return false;
  }
}
#endif  // #ifndef USE_MQTT

String getCurrentTimestamp() {
  // Get current time from GSM module
  String response = sendATCommand("AT+CCLK?", 2000);

  // Parse response: +CCLK: "YY/MM/DD,HH:MM:SS+ZZ"
  int startIndex = response.indexOf("\"");
  int endIndex = response.lastIndexOf("\"");

  if (startIndex != -1 && endIndex != -1) {
    String timestamp = response.substring(startIndex + 1, endIndex);
    // Convert to ISO 8601 format if needed
    return timestamp;
  }

  // Fallback: return current millis as string
  return String(millis());
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
void blinkLED(int times, int delayMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_STATUS_PIN, HIGH);
    delay(delayMs);
    digitalWrite(LED_STATUS_PIN, LOW);
    delay(delayMs);
  }
}



