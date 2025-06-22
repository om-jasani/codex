/*
 * Servo Motor Control with Potentiometer
 * Controls servo motor position using potentiometer input
 * Maps potentiometer value (0-1023) to servo angle (0-180)
 */

#include <Servo.h>

// Pin definitions
const int SERVO_PIN = 9;
const int POT_PIN = A0;
const int LED_PIN = 13;

// Create servo object
Servo myServo;

// Variables
int potValue = 0;
int servoAngle = 0;
int lastAngle = 0;

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  Serial.println("Servo Control with Potentiometer");
  
  // Attach servo to pin
  myServo.attach(SERVO_PIN);
  
  // Set LED pin as output
  pinMode(LED_PIN, OUTPUT);
  
  // Initialize servo to center position
  myServo.write(90);
  delay(1000);
  
  Serial.println("System ready!");
}

void loop() {
  // Read potentiometer value
  potValue = analogRead(POT_PIN);
  
  // Map potentiometer value (0-1023) to servo angle (0-180)
  servoAngle = map(potValue, 0, 1023, 0, 180);
  
  // Only move servo if angle changed significantly
  if (abs(servoAngle - lastAngle) > 2) {
    myServo.write(servoAngle);
    lastAngle = servoAngle;
    
    // Blink LED to indicate movement
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
    
    // Print values to serial monitor
    Serial.print("Pot Value: ");
    Serial.print(potValue);
    Serial.print(" | Servo Angle: ");
    Serial.println(servoAngle);
  }
  
  delay(50);
}

// Function to sweep servo for calibration
void sweepServo() {
  Serial.println("Calibrating servo...");
  
  // Sweep from 0 to 180 degrees
  for (int angle = 0; angle <= 180; angle += 10) {
    myServo.write(angle);
    delay(100);
  }
  
  // Sweep back from 180 to 0 degrees
  for (int angle = 180; angle >= 0; angle -= 10) {
    myServo.write(angle);
    delay(100);
  }
  
  // Return to center
  myServo.write(90);
  Serial.println("Calibration complete!");
}

// Function to smooth servo movement
void smoothMove(int targetAngle) {
  int currentAngle = myServo.read();
  
  if (targetAngle > currentAngle) {
    for (int angle = currentAngle; angle <= targetAngle; angle++) {
      myServo.write(angle);
      delay(15);
    }
  } else {
    for (int angle = currentAngle; angle >= targetAngle; angle--) {
      myServo.write(angle);
      delay(15);
    }
  }
}
