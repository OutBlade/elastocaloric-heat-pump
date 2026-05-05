/*
 * Elastocaloric demonstrator — actuation and sensing controller
 *
 * Hardware:
 *   - Arduino Mega 2560 (or compatible)
 *   - Stepper motor + driver (step/dir interface) for linear actuator
 *   - 2x type-K thermocouples via MAX31855 breakout boards (SPI)
 *   - Force sensor (load cell + HX711 amplifier)
 *   - Serial log output at 115200 baud for data capture
 *
 * Serial output format (one line per sample at ~10 Hz):
 *   timestamp_ms,T_cold_C,T_hot_C,force_N,displacement_mm,power_W
 */

#include <SPI.h>
#include "Adafruit_MAX31855.h"
#include "HX711.h"

// --- Pin assignments ---
#define THERMO_COLD_CS  10
#define THERMO_HOT_CS   9
#define LOADCELL_DOUT   4
#define LOADCELL_CLK    5
#define STEP_PIN        6
#define DIR_PIN         7
#define ENABLE_PIN      8

// --- Actuator parameters ---
#define STEPS_PER_MM    80      // calibrate for your lead screw pitch
#define MAX_STROKE_MM   50
#define CYCLE_FREQ_HZ   0.5     // 0.5 Hz = 2 s per full cycle
#define STEP_DELAY_US   500     // inter-step delay (controls speed)

// --- Load cell calibration ---
#define LOADCELL_SCALE  2280.0  // calibrate with known mass

Adafruit_MAX31855 thermo_cold(THERMO_COLD_CS);
Adafruit_MAX31855 thermo_hot(THERMO_HOT_CS);
HX711 scale;

long current_pos_steps = 0;
long target_pos_steps  = 0;
bool direction_extend  = true;

void setup() {
  Serial.begin(115200);
  while (!Serial) {}

  pinMode(STEP_PIN,   OUTPUT);
  pinMode(DIR_PIN,    OUTPUT);
  pinMode(ENABLE_PIN, OUTPUT);
  digitalWrite(ENABLE_PIN, LOW);  // enable driver

  scale.begin(LOADCELL_DOUT, LOADCELL_CLK);
  scale.set_scale(LOADCELL_SCALE);
  scale.tare();

  // print CSV header
  Serial.println("timestamp_ms,T_cold_C,T_hot_C,force_N,displacement_mm,power_W");
  delay(500);
}

void step_motor(int steps, bool dir) {
  digitalWrite(DIR_PIN, dir ? HIGH : LOW);
  for (int i = 0; i < abs(steps); i++) {
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(STEP_DELAY_US);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(STEP_DELAY_US);
  }
  current_pos_steps += dir ? steps : -steps;
}

void move_to_mm(float target_mm) {
  long target_steps = (long)(target_mm * STEPS_PER_MM);
  long delta = target_steps - current_pos_steps;
  if (delta == 0) return;
  step_motor(abs(delta), delta > 0);
}

void log_sensors() {
  double t_cold = thermo_cold.readCelsius();
  double t_hot  = thermo_hot.readCelsius();
  float  force  = scale.get_units(3);   // average 3 readings
  float  disp   = (float)current_pos_steps / STEPS_PER_MM;

  // power estimate: assume 12 V supply, measure current via shunt if available
  // placeholder — replace with actual current sensor reading
  float power_w = abs(force) * (STEPS_PER_MM * STEP_DELAY_US * 2e-6) * 1000.0f / 1000.0f;

  Serial.print(millis());         Serial.print(',');
  Serial.print(t_cold, 3);        Serial.print(',');
  Serial.print(t_hot,  3);        Serial.print(',');
  Serial.print(force,  3);        Serial.print(',');
  Serial.print(disp,   3);        Serial.print(',');
  Serial.println(power_w, 3);
}

void loop() {
  static unsigned long last_log_ms = 0;
  static unsigned long last_step_ms = 0;
  unsigned long now = millis();

  // Sinusoidal stroke profile: position = A * sin(2π f t)
  float stroke_mm = MAX_STROKE_MM * 0.5f *
                    (1.0f + sin(2.0f * PI * CYCLE_FREQ_HZ * now / 1000.0f));
  move_to_mm(constrain(stroke_mm, 0, MAX_STROKE_MM));

  if (now - last_log_ms >= 100) {  // 10 Hz logging
    log_sensors();
    last_log_ms = now;
  }
}
