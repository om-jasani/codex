/*
 * Stepper Motor Control Library
 * Supports multiple stepper motor types and control methods
 * Includes acceleration, deceleration, and position tracking
 */

#ifndef STEPPER_CONTROL_H
#define STEPPER_CONTROL_H

#include <Arduino.h>

// Motor types
enum MotorType {
  MOTOR_28BYJ48,    // 28BYJ-48 5V stepper
  MOTOR_NEMA17,     // NEMA 17 stepper
  MOTOR_NEMA23      // NEMA 23 stepper
};

// Step modes
enum StepMode {
  FULL_STEP,
  HALF_STEP,
  QUARTER_STEP,
  EIGHTH_STEP
};

class StepperControl {
private:
  // Pin assignments
  int stepPin;
  int dirPin;
  int enablePin;
  
  // Motor parameters
  MotorType motorType;
  StepMode stepMode;
  int stepsPerRevolution;
  float gearRatio;
  
  // Current state
  long currentPosition;
  long targetPosition;
  bool isEnabled;
  bool isMoving;
  
  // Speed and acceleration
  float maxSpeed;        // steps per second
  float currentSpeed;
  float acceleration;    // steps per second²
  float deceleration;
  
  // Timing variables
  unsigned long lastStepTime;
  unsigned long stepInterval;
  
  // Direction
  bool clockwise;
  
public:
  // Constructor
  StepperControl(int stepPin, int dirPin, int enablePin = -1);
  
  // Initialization
  void begin(MotorType type = MOTOR_NEMA17, StepMode mode = FULL_STEP);
  void setMotorType(MotorType type);
  void setStepMode(StepMode mode);
  void setGearRatio(float ratio);
  
  // Movement control
  void setMaxSpeed(float speed);
  void setAcceleration(float accel);
  void setDeceleration(float decel);
  
  void moveTo(long position);
  void moveRelative(long steps);
  void rotate(float degrees);
  void rotateRevolutions(float revolutions);
  
  void stop();
  void emergencyStop();
  void enable();
  void disable();
  
  // Position control
  void setCurrentPosition(long position);
  long getCurrentPosition();
  long getTargetPosition();
  long getDistanceToGo();
  
  // Status
  bool isRunning();
  bool isEnabled();
  float getCurrentSpeed();
  
  // Main update function (call in loop)
  void run();
  
  // Calibration
  void calibrate(int limitSwitchPin);
  void setHome();
  void goHome();
  
private:
  void calculateSpeed();
  void step();
  void setDirection(bool clockwise);
  int getStepsPerRevolution();
};

// Implementation
StepperControl::StepperControl(int stepPin, int dirPin, int enablePin) {
  this->stepPin = stepPin;
  this->dirPin = dirPin;
  this->enablePin = enablePin;
  
  // Initialize pins
  pinMode(stepPin, OUTPUT);
  pinMode(dirPin, OUTPUT);
  if (enablePin >= 0) {
    pinMode(enablePin, OUTPUT);
    digitalWrite(enablePin, HIGH); // Disabled by default
  }
  
  // Initialize variables
  currentPosition = 0;
  targetPosition = 0;
  isEnabled = false;
  isMoving = false;
  maxSpeed = 1000.0;
  currentSpeed = 0.0;
  acceleration = 500.0;
  deceleration = 500.0;
  gearRatio = 1.0;
  clockwise = true;
  lastStepTime = 0;
  stepInterval = 1000;
}

void StepperControl::begin(MotorType type, StepMode mode) {
  motorType = type;
  stepMode = mode;
  stepsPerRevolution = getStepsPerRevolution();
  enable();
}

void StepperControl::setMotorType(MotorType type) {
  motorType = type;
  stepsPerRevolution = getStepsPerRevolution();
}

void StepperControl::setStepMode(StepMode mode) {
  stepMode = mode;
  stepsPerRevolution = getStepsPerRevolution();
}

void StepperControl::setGearRatio(float ratio) {
  gearRatio = ratio;
}

void StepperControl::setMaxSpeed(float speed) {
  maxSpeed = speed;
}

void StepperControl::setAcceleration(float accel) {
  acceleration = accel;
}

void StepperControl::setDeceleration(float decel) {
  deceleration = decel;
}

void StepperControl::moveTo(long position) {
  targetPosition = position;
  isMoving = true;
}

void StepperControl::moveRelative(long steps) {
  targetPosition = currentPosition + steps;
  isMoving = true;
}

void StepperControl::rotate(float degrees) {
  long steps = (long)(degrees * stepsPerRevolution * gearRatio / 360.0);
  moveRelative(steps);
}

void StepperControl::rotateRevolutions(float revolutions) {
  long steps = (long)(revolutions * stepsPerRevolution * gearRatio);
  moveRelative(steps);
}

void StepperControl::stop() {
  targetPosition = currentPosition;
  isMoving = false;
  currentSpeed = 0.0;
}

void StepperControl::emergencyStop() {
  stop();
  disable();
}

void StepperControl::enable() {
  if (enablePin >= 0) {
    digitalWrite(enablePin, LOW); // Active low
  }
  isEnabled = true;
}

void StepperControl::disable() {
  if (enablePin >= 0) {
    digitalWrite(enablePin, HIGH); // Active low
  }
  isEnabled = false;
  isMoving = false;
  currentSpeed = 0.0;
}

void StepperControl::setCurrentPosition(long position) {
  currentPosition = position;
}

long StepperControl::getCurrentPosition() {
  return currentPosition;
}

long StepperControl::getTargetPosition() {
  return targetPosition;
}

long StepperControl::getDistanceToGo() {
  return targetPosition - currentPosition;
}

bool StepperControl::isRunning() {
  return isMoving && (getDistanceToGo() != 0);
}

float StepperControl::getCurrentSpeed() {
  return currentSpeed;
}

void StepperControl::run() {
  if (!isEnabled || !isMoving) {
    return;
  }
  
  long distanceToGo = getDistanceToGo();
  
  if (distanceToGo == 0) {
    isMoving = false;
    currentSpeed = 0.0;
    return;
  }
  
  // Calculate current speed based on acceleration/deceleration
  calculateSpeed();
  
  // Check if it's time for the next step
  unsigned long currentTime = micros();
  if (currentTime - lastStepTime >= stepInterval) {
    step();
    lastStepTime = currentTime;
  }
}

void StepperControl::calculateSpeed() {
  long distanceToGo = getDistanceToGo();
  long stepsToDecelerate = (long)(currentSpeed * currentSpeed / (2.0 * deceleration));
  
  if (abs(distanceToGo) <= stepsToDecelerate) {
    // Deceleration phase
    float newSpeed = currentSpeed - deceleration * (stepInterval / 1000000.0);
    currentSpeed = max(newSpeed, 50.0); // Minimum speed
  } else {
    // Acceleration phase
    float newSpeed = currentSpeed + acceleration * (stepInterval / 1000000.0);
    currentSpeed = min(newSpeed, maxSpeed);
  }
  
  // Update step interval
  stepInterval = (unsigned long)(1000000.0 / currentSpeed);
}

void StepperControl::step() {
  long distanceToGo = getDistanceToGo();
  
  if (distanceToGo > 0) {
    setDirection(true);
    currentPosition++;
  } else {
    setDirection(false);
    currentPosition--;
  }
  
  // Generate step pulse
  digitalWrite(stepPin, HIGH);
  delayMicroseconds(2);
  digitalWrite(stepPin, LOW);
}

void StepperControl::setDirection(bool clockwise) {
  this->clockwise = clockwise;
  digitalWrite(dirPin, clockwise ? HIGH : LOW);
  delayMicroseconds(2); // Direction setup time
}

int StepperControl::getStepsPerRevolution() {
  int baseSteps;
  
  switch (motorType) {
    case MOTOR_28BYJ48:
      baseSteps = 2048; // With built-in gear reduction
      break;
    case MOTOR_NEMA17:
      baseSteps = 200;
      break;
    case MOTOR_NEMA23:
      baseSteps = 200;
      break;
    default:
      baseSteps = 200;
  }
  
  // Apply step mode multiplier
  switch (stepMode) {
    case FULL_STEP:
      return baseSteps;
    case HALF_STEP:
      return baseSteps * 2;
    case QUARTER_STEP:
      return baseSteps * 4;
    case EIGHTH_STEP:
      return baseSteps * 8;
    default:
      return baseSteps;
  }
}

void StepperControl::calibrate(int limitSwitchPin) {
  pinMode(limitSwitchPin, INPUT_PULLUP);
  
  // Move slowly until limit switch is triggered
  setMaxSpeed(100);
  moveRelative(-10000); // Move in negative direction
  
  while (isRunning() && digitalRead(limitSwitchPin) == HIGH) {
    run();
    delay(1);
  }
  
  stop();
  setCurrentPosition(0);
  
  // Move away from limit switch
  moveRelative(100);
  while (isRunning()) {
    run();
    delay(1);
  }
}

void StepperControl::setHome() {
  setCurrentPosition(0);
}

void StepperControl::goHome() {
  moveTo(0);
}

#endif // STEPPER_CONTROL_H

// Example usage:
/*
#include "StepperControl.h"

StepperControl motor(2, 3, 4); // step, dir, enable pins

void setup() {
  Serial.begin(9600);
  motor.begin(MOTOR_NEMA17, QUARTER_STEP);
  motor.setMaxSpeed(1000);
  motor.setAcceleration(500);
  
  // Move 1 revolution
  motor.rotateRevolutions(1.0);
}

void loop() {
  motor.run();
  
  if (!motor.isRunning()) {
    delay(1000);
    motor.rotateRevolutions(-1.0); // Reverse direction
  }
}
*/
