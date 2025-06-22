#!/usr/bin/env python3
"""
Codex Database Setup Script
Initializes the PostgreSQL database and creates the admin user
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import getpass

# Load environment variables
load_dotenv()

def create_database():
    """Create the database if it doesn't exist"""
    print("Creating database...")
    
    try:
        # Connect to PostgreSQL server
        conn = psycopg2.connect(
            host=os.getenv('DATABASE_HOST', 'localhost'),
            port=os.getenv('DATABASE_PORT', 5432),
            user=os.getenv('DATABASE_USER', 'postgres'),
            password=os.getenv('DATABASE_PASSWORD', '')
        )
        conn.autocommit = True
        cursor = conn.cursor()
        
        # Check if database exists
        db_name = os.getenv('DATABASE_NAME', 'codex_db')
        cursor.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s",
            (db_name,)
        )
        
        if not cursor.fetchone():
            # Create database
            cursor.execute(sql.SQL("CREATE DATABASE {}").format(
                sql.Identifier(db_name)
            ))
            print(f"Database '{db_name}' created successfully!")
        else:
            print(f"Database '{db_name}' already exists.")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error creating database: {e}")
        sys.exit(1)

def run_schema():
    """Execute the schema SQL file"""
    print("Running database schema...")
    
    try:
        # Connect to the codex database
        conn = psycopg2.connect(
            host=os.getenv('DATABASE_HOST', 'localhost'),
            port=os.getenv('DATABASE_PORT', 5432),
            database=os.getenv('DATABASE_NAME', 'codex_db'),
            user=os.getenv('DATABASE_USER', 'postgres'),
            password=os.getenv('DATABASE_PASSWORD', '')
        )
        cursor = conn.cursor()
        
        # Read and execute schema
        with open('database/schema.sql', 'r') as f:
            schema_sql = f.read()
        
        cursor.execute(schema_sql)
        conn.commit()
        
        print("Database schema created successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error running schema: {e}")
        sys.exit(1)

def create_admin_user():
    """Create the default admin user"""
    print("\nCreating admin user...")
    
    # Get admin credentials
    username = input("Enter admin username (default: admin): ").strip()
    if not username:
        username = 'admin'
    
    email = input("Enter admin email: ").strip()
    full_name = input("Enter admin full name: ").strip()
    
    # Get password
    while True:
        password = getpass.getpass("Enter admin password: ")
        confirm_password = getpass.getpass("Confirm password: ")
        
        if password == confirm_password:
            break
        else:
            print("Passwords do not match. Please try again.")
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=os.getenv('DATABASE_HOST', 'localhost'),
            port=os.getenv('DATABASE_PORT', 5432),
            database=os.getenv('DATABASE_NAME', 'codex_db'),
            user=os.getenv('DATABASE_USER', 'postgres'),
            password=os.getenv('DATABASE_PASSWORD', '')
        )
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cursor.fetchone():
            print(f"User '{username}' already exists.")
            update = input("Update existing user? (y/n): ").lower()
            if update == 'y':
                cursor.execute("""
                    UPDATE users 
                    SET password_hash = %s, email = %s, full_name = %s 
                    WHERE username = %s
                """, (generate_password_hash(password), email, full_name, username))
            else:
                return
        else:
            # Insert new admin user
            cursor.execute("""
                INSERT INTO users (username, password_hash, email, full_name, role)
                VALUES (%s, %s, %s, %s, 'admin')
            """, (username, generate_password_hash(password), email, full_name))
        
        conn.commit()
        print(f"Admin user '{username}' created successfully!")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error creating admin user: {e}")
        sys.exit(1)

def main():
    """Main setup function"""
    print("Codex Database Setup")
    print("=" * 40)
    
    # Create database
    create_database()
    
    # Run schema
    run_schema()
    
    # Create admin user
    create_admin_user()
    
    print("\nSetup completed successfully!")
    print("You can now start the Codex application.")

if __name__ == "__main__":
    main()
