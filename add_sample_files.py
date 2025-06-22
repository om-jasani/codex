"""
Add Sample Files to Codex
This script adds some sample code files to test the search functionality
"""

import os
import sys
os.chdir('F:\\Codex\\backend')
sys.path.insert(0, 'F:\\Codex\\backend')

from app import create_app, db
from app.models import User, Project, File, Tag
from datetime import datetime

app = create_app()

with app.app_context():
    try:
        # Get the sample project
        project = Project.query.filter_by(name="Sample Project").first()
        if not project:
            print("Creating sample project...")
            project = Project(name="Sample Project", description="Test project")
            db.session.add(project)
            db.session.commit()
        
        # Create some tags
        tag_names = ["arduino", "sensor", "motor", "esp32", "bluetooth"]
        tags = {}
        for tag_name in tag_names:
            tag = Tag.query.filter_by(name=tag_name).first()
            if not tag:
                tag = Tag(name=tag_name, description=f"Tag for {tag_name} related files")
                db.session.add(tag)
            tags[tag_name] = tag
        db.session.commit()
        
        # Sample files data
        sample_files = [
            {
                "filename": "motor_control.ino",
                "filepath": "C:\\Projects\\Sample\\motor_control.ino",
                "filetype": ".ino",
                "description": "Arduino code for controlling DC motors with PWM",
                "tags": ["arduino", "motor"],
                "size": 2048,
                "line_count": 85
            },
            {
                "filename": "temperature_sensor.cpp",
                "filepath": "C:\\Projects\\Sample\\temperature_sensor.cpp",
                "filetype": ".cpp",
                "description": "Temperature and humidity sensor reading with DHT22",
                "tags": ["arduino", "sensor"],
                "size": 1536,
                "line_count": 62
            },
            {
                "filename": "bluetooth_communication.ino",
                "filepath": "C:\\Projects\\Sample\\bluetooth_communication.ino",
                "filetype": ".ino",
                "description": "ESP32 Bluetooth communication example",
                "tags": ["esp32", "bluetooth"],
                "size": 3072,
                "line_count": 120
            },
            {
                "filename": "servo_controller.h",
                "filepath": "C:\\Projects\\Sample\\servo_controller.h",
                "filetype": ".h",
                "description": "Header file for servo motor control library",
                "tags": ["arduino", "motor"],
                "size": 512,
                "line_count": 25
            },
            {
                "filename": "sensor_calibration.py",
                "filepath": "C:\\Projects\\Sample\\sensor_calibration.py",
                "filetype": ".py",
                "description": "Python script for sensor data calibration and analysis",
                "tags": ["sensor"],
                "size": 4096,
                "line_count": 156
            }
        ]
        
        # Add sample files
        for file_data in sample_files:
            # Check if file already exists
            existing = File.query.filter_by(filepath=file_data["filepath"]).first()
            if not existing:
                new_file = File(
                    filename=file_data["filename"],
                    filepath=file_data["filepath"],
                    filetype=file_data["filetype"],
                    project_id=project.id,
                    description=file_data["description"],
                    size=file_data["size"],
                    line_count=file_data["line_count"],
                    modified_date=datetime.now()
                )
                
                # Add tags
                for tag_name in file_data["tags"]:
                    if tag_name in tags:
                        new_file.tags.append(tags[tag_name])
                
                db.session.add(new_file)
                print(f"Added: {file_data['filename']}")
            else:
                print(f"Already exists: {file_data['filename']}")
        
        db.session.commit()
        print("\nSample files added successfully!")
        print("You can now search for: motor, sensor, bluetooth, esp32, arduino, etc.")
        
    except Exception as e:
        print(f"Error: {e}")
        db.session.rollback()
        import traceback
        traceback.print_exc()
