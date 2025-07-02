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

# Setup paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

# Load environment variables
load_dotenv(os.path.join(project_root, '.env'))

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
        
        # Create admin user
        password_hash = generate_password_hash('admin123')
        cursor.execute("""
            INSERT INTO users (username, full_name, email, password_hash, role, is_active)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, ('admin', 'Administrator', 'admin@codex.local', password_hash, 'admin', True))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print("✅ Default admin user created successfully!")
        print("   Username: admin")
        print("   Password: admin123")
        print("   ⚠️  Please change the password after first login!")
        
        return True
    except Exception as e:
        print(f"Error creating admin user: {e}")
        return False

def main():
    print("🔧 Codex Initial Setup")
    print("=" * 30)
    
    if check_admin_exists():
        print("✅ Admin user already exists. No setup needed.")
    else:
        print("👤 No admin user found. Creating default admin...")
        create_default_admin()

if __name__ == "__main__":
    main()
