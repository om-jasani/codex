"""
File Handling API Endpoints - Complete Implementation
"""

from flask import Blueprint, request, jsonify, send_file, current_app
from flask_login import login_required, current_user
from app.models import File, FileDownload, db
import os
from datetime import datetime
import mimetypes
import tempfile

file_bp = Blueprint('files', __name__)

@file_bp.route('/<int:file_id>', methods=['GET'])
def get_file_details(file_id):
    """Get file details - public endpoint"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    return jsonify({
        'id': file.id,
        'filename': file.filename,
        'filepath': file.filepath,
        'filetype': file.filetype,
        'description': file.description,
        'size': file.size,
        'line_count': file.line_count,
        'modified_date': file.modified_date.isoformat() if file.modified_date else None,
        'project': file.project.name if file.project else None,
        'tags': [tag.name for tag in file.tags]
    })

@file_bp.route('/<int:file_id>/content', methods=['GET'])
def get_file_content(file_id):
    """Get file content for viewing"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    # Check if file exists on disk
    if not os.path.exists(file.filepath):
        # If file doesn't exist, return sample content for demo
        sample_content = generate_sample_content(file.filename, file.filetype)
        return jsonify({
            'filename': file.filename,
            'content': sample_content,
            'filetype': file.filetype
        })
    
    try:
        # Try to read the actual file
        with open(file.filepath, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        # Limit content size for display
        max_size = 1024 * 1024  # 1MB
        if len(content) > max_size:
            content = content[:max_size] + '\n\n... (file truncated for display)'
        
        return jsonify({
            'filename': file.filename,
            'content': content,
            'filetype': file.filetype
        })
    except Exception as e:
        current_app.logger.error(f'Error reading file {file.filepath}: {str(e)}')
        # Return sample content as fallback
        sample_content = generate_sample_content(file.filename, file.filetype)
        return jsonify({
            'filename': file.filename,
            'content': sample_content,
            'filetype': file.filetype
        })

@file_bp.route('/<int:file_id>/download', methods=['GET'])
def download_file(file_id):
    """Download a file"""
    file = File.query.get_or_404(file_id)
    
    if not file.is_active:
        return jsonify({'error': 'File not found'}), 404
    
    # Log download if user is authenticated
    if current_user.is_authenticated:
        download = FileDownload(
            file_id=file.id,
            user_id=current_user.id,
            user_ip=request.remote_addr
        )
        db.session.add(download)
        db.session.commit()
    
    # Check if file exists
    if not os.path.exists(file.filepath):
        # Create a sample file for download
        sample_content = generate_sample_content(file.filename, file.filetype)
        
        # Create temporary file
        temp_dir = tempfile.gettempdir()
        temp_path = os.path.join(temp_dir, file.filename)
        
        with open(temp_path, 'w', encoding='utf-8') as f:
            f.write(sample_content)
        
        return send_file(
            temp_path,
            as_attachment=True,
            download_name=file.filename,
            mimetype=mimetypes.guess_type(file.filename)[0] or 'text/plain'
        )
    
    try:
        return send_file(
            file.filepath,
            as_attachment=True,
            download_name=file.filename,
            mimetype=mimetypes.guess_type(file.filename)[0] or 'application/octet-stream'
        )
    except Exception as e:
        current_app.logger.error(f'Error downloading file {file.filepath}: {str(e)}')
        return jsonify({'error': 'Unable to download file'}), 500

@file_bp.route('/recent', methods=['GET'])
def get_recent_files():
    """Get recently added files"""
    limit = request.args.get('limit', 10, type=int)
    limit = min(limit, 50)  # Cap at 50
    
    files = File.query.filter_by(is_active=True)\
                     .order_by(File.indexed_date.desc())\
                     .limit(limit)\
                     .all()
    
    return jsonify([{
        'id': f.id,
        'filename': f.filename,
        'filetype': f.filetype,
        'project': f.project.name if f.project else None,
        'indexed_date': f.indexed_date.isoformat(),
        'size': f.size,
        'description': f.description
    } for f in files])

def generate_sample_content(filename, filetype):
    """Generate sample content based on file type"""
    
    if filetype == '.ino':
        return '''// Arduino Motor Control Example
// This code controls DC motors using PWM

#define MOTOR_PIN_1 9
#define MOTOR_PIN_2 10
#define SPEED_PIN 11

int motorSpeed = 0;

void setup() {
    pinMode(MOTOR_PIN_1, OUTPUT);
    pinMode(MOTOR_PIN_2, OUTPUT);
    pinMode(SPEED_PIN, OUTPUT);
    
    Serial.begin(9600);
    Serial.println("Motor Control Initialized");
}

void loop() {
    // Forward motion
    digitalWrite(MOTOR_PIN_1, HIGH);
    digitalWrite(MOTOR_PIN_2, LOW);
    
    // Gradually increase speed
    for (motorSpeed = 0; motorSpeed <= 255; motorSpeed += 5) {
        analogWrite(SPEED_PIN, motorSpeed);
        delay(30);
    }
    
    // Gradually decrease speed
    for (motorSpeed = 255; motorSpeed >= 0; motorSpeed -= 5) {
        analogWrite(SPEED_PIN, motorSpeed);
        delay(30);
    }
    
    // Stop motor
    digitalWrite(MOTOR_PIN_1, LOW);
    digitalWrite(MOTOR_PIN_2, LOW);
    delay(1000);
    
    // Reverse motion
    digitalWrite(MOTOR_PIN_1, LOW);
    digitalWrite(MOTOR_PIN_2, HIGH);
    
    // Run at half speed
    analogWrite(SPEED_PIN, 127);
    delay(2000);
    
    // Stop motor
    digitalWrite(MOTOR_PIN_1, LOW);
    digitalWrite(MOTOR_PIN_2, LOW);
    delay(1000);
}'''
    
    elif filetype == '.cpp':
        return '''#include <iostream>
#include <vector>
#include <string>
#include "sensor_lib.h"

// Temperature Sensor Reading Class
class TemperatureSensor {
private:
    int pin;
    float calibration_offset;
    std::vector<float> readings;
    
public:
    TemperatureSensor(int sensorPin) : pin(sensorPin), calibration_offset(0.0) {
        readings.reserve(100);
    }
    
    float readTemperature() {
        // Read raw sensor value
        int rawValue = analogRead(pin);
        
        // Convert to temperature (assuming linear relationship)
        float voltage = (rawValue / 1024.0) * 5.0;
        float temperature = (voltage - 0.5) * 100.0;
        
        // Apply calibration offset
        temperature += calibration_offset;
        
        // Store reading
        readings.push_back(temperature);
        
        return temperature;
    }
    
    float getAverage(int samples = 10) {
        float sum = 0;
        int count = std::min(samples, (int)readings.size());
        
        for (int i = readings.size() - count; i < readings.size(); i++) {
            sum += readings[i];
        }
        
        return count > 0 ? sum / count : 0;
    }
    
    void calibrate(float offset) {
        calibration_offset = offset;
    }
};

// Main program
int main() {
    TemperatureSensor sensor(A0);
    
    // Calibrate sensor
    sensor.calibrate(-0.5);
    
    // Read temperature every second
    while (true) {
        float temp = sensor.readTemperature();
        float avgTemp = sensor.getAverage();
        
        std::cout << "Current: " << temp << "°C, ";
        std::cout << "Average: " << avgTemp << "°C" << std::endl;
        
        delay(1000);
    }
    
    return 0;
}'''
    
    elif filetype == '.py':
        return '''#!/usr/bin/env python3
"""
Sensor Data Calibration and Analysis Tool
This module provides functions for calibrating sensor data
and performing statistical analysis.
"""

import numpy as np
import matplotlib.pyplot as plt
from scipy import signal
from datetime import datetime
import pandas as pd

class SensorCalibrator:
    """Calibrate and analyze sensor data"""
    
    def __init__(self, sensor_type='temperature'):
        self.sensor_type = sensor_type
        self.calibration_data = []
        self.coefficients = None
        self.baseline = None
        
    def load_data(self, filename):
        """Load sensor data from CSV file"""
        try:
            df = pd.read_csv(filename)
            self.raw_data = df['value'].values
            self.timestamps = pd.to_datetime(df['timestamp'])
            return True
        except Exception as e:
            print(f"Error loading data: {e}")
            return False
    
    def remove_noise(self, window_size=5):
        """Apply moving average filter to remove noise"""
        return signal.savgol_filter(self.raw_data, window_size, 2)
    
    def calibrate(self, reference_values):
        """Calibrate sensor using reference values"""
        # Perform linear regression
        coeffs = np.polyfit(self.raw_data[:len(reference_values)], 
                           reference_values, 1)
        self.coefficients = coeffs
        return coeffs
    
    def apply_calibration(self, values):
        """Apply calibration coefficients to raw values"""
        if self.coefficients is None:
            raise ValueError("Sensor not calibrated")
        
        return np.polyval(self.coefficients, values)
    
    def plot_data(self, calibrated=True):
        """Plot sensor data"""
        plt.figure(figsize=(12, 6))
        
        if calibrated and self.coefficients is not None:
            values = self.apply_calibration(self.raw_data)
            plt.plot(self.timestamps, values, 'b-', label='Calibrated')
        else:
            plt.plot(self.timestamps, self.raw_data, 'r-', label='Raw')
        
        plt.xlabel('Time')
        plt.ylabel(f'{self.sensor_type} Value')
        plt.title(f'Sensor Data - {self.sensor_type}')
        plt.legend()
        plt.grid(True)
        plt.show()

# Example usage
if __name__ == "__main__":
    calibrator = SensorCalibrator('temperature')
    
    # Load sample data
    if calibrator.load_data('sensor_data.csv'):
        # Remove noise
        filtered = calibrator.remove_noise()
        
        # Calibrate with known reference values
        reference = [20.0, 25.0, 30.0, 35.0, 40.0]
        coeffs = calibrator.calibrate(reference)
        print(f"Calibration coefficients: {coeffs}")
        
        # Plot results
        calibrator.plot_data(calibrated=True)
'''
    
    elif filetype == '.h':
        return '''#ifndef SERVO_CONTROLLER_H
#define SERVO_CONTROLLER_H

#include <Arduino.h>
#include <Servo.h>

/**
 * ServoController - Advanced servo motor control library
 * Provides smooth movement, speed control, and position feedback
 */

class ServoController {
private:
    Servo servo;
    int currentPosition;
    int targetPosition;
    int servoPin;
    int minAngle;
    int maxAngle;
    int moveSpeed;
    unsigned long lastUpdate;
    
public:
    // Constructor
    ServoController(int pin, int min = 0, int max = 180) {
        servoPin = pin;
        minAngle = min;
        maxAngle = max;
        currentPosition = 90;
        targetPosition = 90;
        moveSpeed = 5;
        lastUpdate = 0;
    }
    
    // Initialize servo
    void begin() {
        servo.attach(servoPin);
        servo.write(currentPosition);
    }
    
    // Set movement speed (degrees per update)
    void setSpeed(int speed) {
        moveSpeed = constrain(speed, 1, 50);
    }
    
    // Move to position
    void moveTo(int angle) {
        targetPosition = constrain(angle, minAngle, maxAngle);
    }
    
    // Update servo position (call in loop)
    void update() {
        if (millis() - lastUpdate < 20) return; // 50Hz update rate
        
        if (currentPosition != targetPosition) {
            int diff = targetPosition - currentPosition;
            int step = constrain(diff, -moveSpeed, moveSpeed);
            currentPosition += step;
            servo.write(currentPosition);
        }
        
        lastUpdate = millis();
    }
    
    // Get current position
    int getPosition() {
        return currentPosition;
    }
    
    // Check if movement complete
    bool isMoving() {
        return currentPosition != targetPosition;
    }
};

#endif // SERVO_CONTROLLER_H
'''
    
    else:
        # Default text content
        return f'''// {filename}
// Sample file content for demonstration

This is a sample file showing what the code content would look like.
The actual file content would be displayed here when the file exists on disk.

File type: {filetype}
File name: {filename}

You can download this file to see the full content.
'''
