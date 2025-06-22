#!/usr/bin/env python3
"""
Initial Setup Helper
Creates a default admin user if none exists
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash

# Load environment variables
load_dotenv()

def check_admin_exists():
    """Check if any admin user exists"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DATABASE_HOST', 'localhost'),
            port=os.getenv('DATABASE_PORT', 5432),
            database=os.getenv('DATABASE_NAME', 'codex_db'),
            user=os.getenv('DATABASE_USER', 'postgres'),
            password=os.getenv('DATABASE_PASSWORD', '')
        )
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin'")
        admin_count = cursor.fetchone()[0]
        
        cursor.close()
        conn.close()
        
        return admin_count > 0
    except Exception as e:
        print(f"Database error: {e}")
        return False

def create_default_admin():
    """Create default admin user"""
    try:
        conn = psycopg2.connect(
            host=os.getenv('DATABASE_HOST', 'localhost'),
            port=os.getenv('DATABASE_PORT', 5432),
            database=os.getenv('DATABASE_NAME', 'codex_db'),
            user=os.getenv('DATABASE_USER', 'postgres'),
            password=os.getenv('DATABASE_PASSWORD', '')
        )
        cursor = conn.cursor()
        
        # Create default admin
        cursor.execute("""
            INSERT INTO users (username, password_hash, email, full_name, role)
            VALUES (%s, %s, %s, %s, 'admin')
            ON CONFLICT (username) DO NOTHING
        """, ('admin', generate_password_hash('admin123'), 'admin@codex.local', 'Administrator'))
        
        conn.commit()
        print("Default admin user created!")
        print("Username: admin")
        print("Password: admin123")
        print("IMPORTANT: Change this password after first login!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error creating admin: {e}")

if __name__ == "__main__":
    if not check_admin_exists():
        print("No admin user found. Creating default admin...")
        create_default_admin()
    else:
        print("Admin user already exists.")
