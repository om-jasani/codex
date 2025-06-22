"""
Medical Device Data Logger
Python script for collecting and processing sensor data from medical devices

Author: Medical Instruments Team
Date: 2024-01-20
Version: 2.1.0
"""

import serial
import json
import sqlite3
import time
import logging
import threading
from datetime import datetime, timedelta
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
import pandas as pd
import numpy as np

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('medical_logger.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MedicalReading:
    """Data structure for medical sensor readings"""
    device_id: str
    timestamp: datetime
    heart_rate: Optional[float] = None
    blood_pressure_systolic: Optional[float] = None
    blood_pressure_diastolic: Optional[float] = None
    oxygen_saturation: Optional[float] = None
    temperature: Optional[float] = None
    respiratory_rate: Optional[float] = None
    patient_id: Optional[str] = None
    notes: Optional[str] = None

class MedicalDataLogger:
    """
    Main class for logging medical device data
    Handles serial communication, data validation, and database storage
    """
    
    def __init__(self, port: str = '/dev/ttyUSB0', baudrate: int = 9600, 
                 db_path: str = 'medical_data.db'):
        self.port = port
        self.baudrate = baudrate
        self.db_path = db_path
        self.serial_connection: Optional[serial.Serial] = None
        self.is_running = False
        self.data_buffer: List[MedicalReading] = []
        self.lock = threading.Lock()
        
        # Initialize database
        self.init_database()
        
        # Data validation limits
        self.validation_limits = {
            'heart_rate': (40, 200),
            'blood_pressure_systolic': (70, 250),
            'blood_pressure_diastolic': (40, 150),
            'oxygen_saturation': (70, 100),
            'temperature': (32.0, 42.0),  # Celsius
            'respiratory_rate': (8, 40)
        }

    def init_database(self) -> None:
        """Initialize SQLite database for storing medical readings"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS medical_readings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    device_id TEXT NOT NULL,
                    timestamp DATETIME NOT NULL,
                    heart_rate REAL,
                    blood_pressure_systolic REAL,
                    blood_pressure_diastolic REAL,
                    oxygen_saturation REAL,
                    temperature REAL,
                    respiratory_rate REAL,
                    patient_id TEXT,
                    notes TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create indexes for better query performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON medical_readings(timestamp)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_device_id ON medical_readings(device_id)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_patient_id ON medical_readings(patient_id)')
            
            conn.commit()
            conn.close()
            logger.info("Database initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise

    def connect_serial(self) -> bool:
        """Establish serial connection to medical device"""
        try:
            self.serial_connection = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=1,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
            logger.info(f"Connected to device on {self.port}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to device: {e}")
            return False

    def disconnect_serial(self) -> None:
        """Close serial connection"""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.close()
            logger.info("Serial connection closed")

    def parse_device_data(self, raw_data: str) -> Optional[MedicalReading]:
        """
        Parse raw data from medical device
        Expected format: JSON string with sensor values
        """
        try:
            data = json.loads(raw_data.strip())
            
            reading = MedicalReading(
                device_id=data.get('device_id', 'unknown'),
                timestamp=datetime.fromisoformat(data.get('timestamp', datetime.now().isoformat())),
                heart_rate=data.get('heart_rate'),
                blood_pressure_systolic=data.get('bp_systolic'),
                blood_pressure_diastolic=data.get('bp_diastolic'),
                oxygen_saturation=data.get('spo2'),
                temperature=data.get('temperature'),
                respiratory_rate=data.get('respiratory_rate'),
                patient_id=data.get('patient_id'),
                notes=data.get('notes')
            )
            
            return reading
            
        except (json.JSONDecodeError, ValueError, KeyError) as e:
            logger.warning(f"Failed to parse device data: {e}")
            return None

    def validate_reading(self, reading: MedicalReading) -> bool:
        """Validate medical reading against acceptable ranges"""
        for field, (min_val, max_val) in self.validation_limits.items():
            value = getattr(reading, field)
            if value is not None and not (min_val <= value <= max_val):
                logger.warning(f"Invalid {field}: {value} (should be {min_val}-{max_val})")
                return False
        return True

    def store_reading(self, reading: MedicalReading) -> bool:
        """Store validated reading in database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO medical_readings (
                    device_id, timestamp, heart_rate, blood_pressure_systolic,
                    blood_pressure_diastolic, oxygen_saturation, temperature,
                    respiratory_rate, patient_id, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                reading.device_id, reading.timestamp, reading.heart_rate,
                reading.blood_pressure_systolic, reading.blood_pressure_diastolic,
                reading.oxygen_saturation, reading.temperature,
                reading.respiratory_rate, reading.patient_id, reading.notes
            ))
            
            conn.commit()
            conn.close()
            logger.debug(f"Stored reading from {reading.device_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to store reading: {e}")
            return False

    def start_logging(self) -> None:
        """Start continuous data logging from medical device"""
        if not self.connect_serial():
            return
        
        self.is_running = True
        logger.info("Starting medical data logging...")
        
        try:
            while self.is_running:
                if self.serial_connection.in_waiting > 0:
                    raw_data = self.serial_connection.readline().decode('utf-8', errors='ignore')
                    
                    if raw_data:
                        reading = self.parse_device_data(raw_data)
                        
                        if reading and self.validate_reading(reading):
                            # Store in buffer for batch processing
                            with self.lock:
                                self.data_buffer.append(reading)
                            
                            # Store in database
                            self.store_reading(reading)
                            
                            logger.info(f"Logged reading: HR={reading.heart_rate}, "
                                      f"SpO2={reading.oxygen_saturation}%")
                        
                time.sleep(0.1)  # Small delay to prevent CPU overload
                
        except KeyboardInterrupt:
            logger.info("Stopping data logging...")
        except Exception as e:
            logger.error(f"Error during logging: {e}")
        finally:
            self.stop_logging()

    def stop_logging(self) -> None:
        """Stop data logging and cleanup"""
        self.is_running = False
        self.disconnect_serial()
        
        # Process any remaining buffered data
        if self.data_buffer:
            logger.info(f"Processing {len(self.data_buffer)} buffered readings")
            # Additional processing could be done here
        
        logger.info("Data logging stopped")

    def get_readings_by_timeframe(self, start_time: datetime, 
                                  end_time: datetime) -> List[Dict[str, Any]]:
        """Retrieve readings within specified timeframe"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                SELECT * FROM medical_readings 
                WHERE timestamp BETWEEN ? AND ?
                ORDER BY timestamp ASC
            ''', (start_time, end_time))
            
            columns = [description[0] for description in cursor.description]
            readings = [dict(zip(columns, row)) for row in cursor.fetchall()]
            
            conn.close()
            return readings
            
        except Exception as e:
            logger.error(f"Failed to retrieve readings: {e}")
            return []

    def generate_report(self, patient_id: str, hours: int = 24) -> Dict[str, Any]:
        """Generate medical report for specific patient"""
        end_time = datetime.now()
        start_time = end_time - timedelta(hours=hours)
        
        readings = self.get_readings_by_timeframe(start_time, end_time)
        patient_readings = [r for r in readings if r['patient_id'] == patient_id]
        
        if not patient_readings:
            return {"error": "No readings found for patient"}
        
        # Calculate statistics
        df = pd.DataFrame(patient_readings)
        
        report = {
            "patient_id": patient_id,
            "period": f"{hours} hours",
            "total_readings": len(patient_readings),
            "statistics": {}
        }
        
        for column in ['heart_rate', 'blood_pressure_systolic', 'blood_pressure_diastolic', 
                      'oxygen_saturation', 'temperature', 'respiratory_rate']:
            if column in df.columns and df[column].notna().any():
                values = df[column].dropna()
                report["statistics"][column] = {
                    "mean": float(values.mean()),
                    "min": float(values.min()),
                    "max": float(values.max()),
                    "std": float(values.std())
                }
        
        return report

    def export_data_csv(self, filename: str, start_time: datetime, 
                        end_time: datetime) -> bool:
        """Export readings to CSV file"""
        try:
            readings = self.get_readings_by_timeframe(start_time, end_time)
            if not readings:
                logger.warning("No data to export")
                return False
            
            df = pd.DataFrame(readings)
            df.to_csv(filename, index=False)
            logger.info(f"Data exported to {filename}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to export data: {e}")
            return False

def main():
    """Main function for running the medical data logger"""
    logger.info("Starting Medical Device Data Logger v2.1.0")
    
    # Create logger instance
    med_logger = MedicalDataLogger(
        port='/dev/ttyUSB0',  # Adjust for your system
        baudrate=9600,
        db_path='medical_readings.db'
    )
    
    try:
        # Start logging in a separate thread
        logging_thread = threading.Thread(target=med_logger.start_logging)
        logging_thread.start()
        
        # Keep main thread alive
        while med_logger.is_running:
            time.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Shutdown requested")
        med_logger.stop_logging()

if __name__ == "__main__":
    main()
