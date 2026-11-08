// Wrist controller for the Tunnel Runner and Moto games.
// Works with an MPU-6050 (GY-521, HW-123) or an MPU-9250 (same accelerometer and gyro registers).
//
// Wiring (Arduino Mega):
//   VCC -> 5V for GY-521 / HW-123 (3.3V for a bare MPU-9250), GND -> GND
//   SDA -> pin 20, SCL -> pin 21, AD0 -> GND (address 0x68)
//
// Mounting: board flat on the back of your hand, component side up,
// the X arrow pointing toward your fingers.
//
// Output, about 50 lines per second at 115200 baud:   roll,pitch,flick
//   roll  > 0 : right side of the hand tilts down
//   pitch > 0 : fingers point down
//   flick = 1 : a double wrist flick was detected (sent once)  -> jump
//   flick = 3 : a triple wrist flick was detected (sent once)  -> double jump
//   (a single flick sends nothing)


#include <Wire.h>


uint8_t ADDR = 0x68;                       // found automatically (0x68 or 0x69)
const float ALPHA = 0.96;                  // gyro vs accelerometer blend
const float FLICK_DPS = 350.0;             // rotation speed that counts as a flick
const unsigned long DOUBLE_WINDOW = 700;   // max time between the two flicks (ms)
const unsigned long REFRACT = 120;         // minimum time between flicks (ms)
const unsigned long HOLD_MS = 150;         // freeze tilt output after a flick (ms)  [CHANGED: was 450]


float gxo = 0, gyo = 0, gzo = 0;
float roll = 0, pitch = 0, outRoll = 0, outPitch = 0;
unsigned long lastMicros = 0, lastSend = 0, lastFlick = 0, holdUntil = 0;
bool armed = true;
int flickCount = 0;                        // flicks in the current burst  [CHANGED: replaces "waiting"]


void writeReg(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(ADDR);
  Wire.write(reg);
  Wire.write(val);
  Wire.endTransmission();
}


uint8_t readReg(uint8_t reg) {
  Wire.beginTransmission(ADDR);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(ADDR, (uint8_t)1);
  return Wire.available() ? Wire.read() : 0;
}


bool readIMU(float &ax, float &ay, float &az, float &gx, float &gy, float &gz) {
  Wire.beginTransmission(ADDR);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(ADDR, (uint8_t)14) != 14) return false;
  int16_t v[7];
  for (int i = 0; i < 7; i++) {
    int16_t hi = Wire.read();
    int16_t lo = Wire.read();
    v[i] = (int16_t)((hi << 8) | lo);
  }
  ax = v[0] / 16384.0;  ay = v[1] / 16384.0;  az = v[2] / 16384.0;   // g
  gx = v[4] / 32.8;     gy = v[5] / 32.8;     gz = v[6] / 32.8;      // deg/s
  return true;
}


void setup() {
  Serial.begin(115200);
  Serial.println("BOOT");            // [ADDED] proves the board is running, printed before touching the sensor
  Wire.begin();
  Wire.setWireTimeout(3000, true);   // [ADDED] if the sensor wires are wrong, give up instead of freezing forever
  Wire.setClock(100000);   // slow and safe for jumper wires
  delay(10);


  // Find the sensor at 0x68 or 0x69.
  uint8_t found = 0;
  const uint8_t tryAddr[2] = {0x68, 0x69};
  for (int i = 0; i < 2 && !found; i++) {
    Wire.beginTransmission(tryAddr[i]);
    if (Wire.endTransmission() == 0) found = tryAddr[i];
  }
  if (!found) { Serial.println("NO_SENSOR: nothing answers at 0x68 or 0x69, check wiring"); while (true) {} }
  ADDR = found;
  Serial.print("SENSOR 0x"); Serial.println(ADDR, HEX);


  writeReg(0x6B, 0x00);   // wake up
  delay(100);
  Serial.print("WHO_AM_I 0x"); Serial.println(readReg(0x75), HEX);
  writeReg(0x1A, 0x03);   // low-pass filter, about 44 Hz
  writeReg(0x1B, 0x10);   // gyro range +-1000 deg/s
  writeReg(0x1C, 0x00);   // accelerometer range +-2 g
  delay(100);


  // Measure the gyro offsets while the hand rests still.
  float sx = 0, sy = 0, sz = 0;
  int n = 0, tries = 0;
  float ax, ay, az, gx, gy, gz;
  while (n < 200) {
    if (readIMU(ax, ay, az, gx, gy, gz)) { sx += gx; sy += gy; sz += gz; n++; }
    if (++tries > 2000) { Serial.println("NO_SENSOR: found the chip but reads fail, check wires or power"); while (true) {} }
    delay(5);
  }
  gxo = sx / n;  gyo = sy / n;  gzo = sz / n;


  roll  = atan2(ay, az) * RAD_TO_DEG;
  pitch = atan2(-ax, sqrt(ay * ay + az * az)) * RAD_TO_DEG;
  outRoll = roll;  outPitch = pitch;
  lastMicros = micros();
  Serial.println("READY");
}


void loop() {
  unsigned long nowUs = micros();
  if (nowUs - lastMicros < 10000) return;            // about 100 Hz sensor loop
  float dt = (nowUs - lastMicros) / 1000000.0;
  lastMicros = nowUs;


  float ax, ay, az, gx, gy, gz;
  if (!readIMU(ax, ay, az, gx, gy, gz)) return;
  gx -= gxo;  gy -= gyo;  gz -= gzo;


  float accRoll  = atan2(ay, az) * RAD_TO_DEG;
  float accPitch = atan2(-ax, sqrt(ay * ay + az * az)) * RAD_TO_DEG;
  roll  = ALPHA * (roll  + gx * dt) + (1.0 - ALPHA) * accRoll;
  pitch = ALPHA * (pitch + gy * dt) + (1.0 - ALPHA) * accPitch;


  unsigned long now = millis();
  float rate = sqrt(gx * gx + gy * gy + gz * gz);
  int flick = 0;


  if (rate > FLICK_DPS) {
    holdUntil = now + HOLD_MS;                       // ignore tilt during the flick
    if (armed && now - lastFlick > REFRACT) {
      // [CHANGED] count the flicks in a burst: 2nd flick = jump, 3rd flick = double jump
      if (now - lastFlick > DOUBLE_WINDOW) flickCount = 0;
      flickCount++;
      if (flickCount == 2) flick = 1;
      else if (flickCount == 3) { flick = 3; flickCount = 0; }
      lastFlick = now;
      armed = false;
    }
  } else if (rate < FLICK_DPS * 0.4) {
    armed = true;
  }
  if (flickCount > 0 && now - lastFlick > DOUBLE_WINDOW) flickCount = 0;   // [CHANGED] burst timed out


  if (now > holdUntil) { outRoll = roll; outPitch = pitch; }


  if (flick || now - lastSend >= 20) {
    lastSend = now;
    Serial.print(outRoll, 1);  Serial.print(',');
    Serial.print(outPitch, 1); Serial.print(',');
    Serial.println(flick);
  }
}
