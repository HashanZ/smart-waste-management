# IoT Bin Setup Guide

This guide details the physical assembly and software configuration of the smart waste bin sensor node.

## Hardware Components

- **ESP32 DevKit V1**: Core microcontroller.
- **HC-SR04 Ultrasonic Sensor**: Measures container fill level.
- **SIM800L GSM Module**: Enables GPRS cellular data upload.
- **Power Supply (5V, 2A)**: Required for stable operation due to high GSM transmission current spikes.
- **Capacitor (1000µF, 16V)**: Placed across SIM800L VCC and GND to stabilize cellular connection spikes.

## Pin Connections

```
ESP32 DevKit V1          Component
─────────────────────────────────────────
3.3V                     ──> HC-SR04 VCC
GND                      ──> HC-SR04 GND
GPIO 5                   ──> HC-SR04 TRIG
GPIO 18                  ──> HC-SR04 ECHO (via 10kΩ/10kΩ voltage divider)

5V (Power Supply)        ──> SIM800L VCC (via 1000µF capacitor)
GND                      ──> SIM800L GND
GPIO 16 (RX2)            ──> SIM800L TX
GPIO 17 (TX2)            ──> SIM800L RX
```

> [!IMPORTANT]
> The HC-SR04 ECHO pin outputs 5V. To prevent damage to the 3.3V ESP32 GPIO, use a simple voltage divider (ECHO -> 10kΩ resistor -> GPIO 18, and GPIO 18 -> 10kΩ resistor -> GND) to step down the signal to 2.5V.

---

## Software Installation

### Setup Board Support in Arduino IDE
1. Open Arduino IDE.
2. Go to **File → Preferences** and add the following URL under **Additional Boards Manager URLs**:
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
3. Go to **Tools → Board → Boards Manager**, search for `esp32`, and install `esp32 by Espressif Systems`.
4. Choose **Tools → Board → ESP32 Arduino → ESP32 Dev Module**.

### Install Libraries
Manage and install the following libraries inside the IDE:
- **ArduinoJson** (version 6.x)

---

## Firmware Configuration

Update the following definitions in `iot-device/ESP32_SmartWasteBin/ESP32_SmartWasteBin.ino` before flashing:

```cpp
#define BIN_ID "BIN001"                  // Database identifier
#define BIN_HEIGHT_CM 100                // Total empty depth of the waste bin
#define API_URL "http://<YOUR_API>/api"  // Endpoint for posting bin updates
#define UPDATE_INTERVAL 300000           // Reading interval in milliseconds (5 mins)
```

Configure your cellular carrier Access Point Name (APN) in the initialization code block:
```cpp
sendATCommand("AT+SAPBR=3,1,\"APN\",\"internet\"", 2000); // Replace 'internet' with your carrier APN
```

---

## Testing & Troubleshooting

### Serial Connection Verification
Connect the ESP32 to your computer, set the serial monitor baud rate to `115200`, and observe startup logs.

### GSM Failure
- **Symptoms**: Serial prints `Failed to initialize GSM module`.
- **Solution**: Check power cables. Verify SIM800L receives stable voltage. Confirm a capacitor is installed close to the module power inputs.
