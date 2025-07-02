#!/usr/bin/env python3
"""
DC Codex Database Setup Script
Initializes the PostgreSQL database and creates the admin user
"""

import os
import sys
import psycopg2
from psycopg2 import sql
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash
import getpass

# Setup paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
backend_path = os.path.join(project_root, 'backend')
sys.path.insert(0, backend_path)

# Load environment variables
load_dotenv(os.path.join(project_root, '.env'))

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
        return True
        
    except Exception as e:
        print(f"Error creating database: {e}")
        return False

def create_tables():
    """Create database tables using Flask-SQLAlchemy"""
    print("Creating database tables...")
    
    try:
        from app import create_app, db
        
        app = create_app()
        with app.app_context():
            # Create all tables
            db.create_all()
            print("Database tables created successfully!")
            return True
            
    except Exception as e:
        print(f"Error creating tables: {e}")
        return False

def run_schema():
    """Execute the schema SQL file if it exists"""
    print("Checking for database schema file...")
    
    schema_path = os.path.join(project_root, 'database', 'schema.sql')
    if not os.path.exists(schema_path):
        print("No schema.sql file found, skipping...")
        return True
    
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
        with open(schema_path, 'r') as f:
            schema_sql = f.read()
        
        cursor.execute(schema_sql)
        conn.commit()
        
        print("Database schema executed successfully!")
        
        cursor.close()
        conn.close()
        return True
        
    except Exception as e:
        print(f"Error running schema: {e}")
        return False

def create_admin_user():
    """Create the admin user"""
    print("Creating admin user...")
    
    try:
        from app import create_app, db
        from app.models import User
        
        app = create_app()
        with app.app_context():
            # Check if admin already exists
            if User.query.filter_by(username='admin').first():
                print("Admin user already exists!")
                return True
            
            # Get admin details
            print("Enter admin user details:")
            username = input("Username [admin]: ").strip() or 'admin'
            email = input("Email [admin@codex.local]: ").strip() or 'admin@codex.local'
            full_name = input("Full Name [Administrator]: ").strip() or 'Administrator'
            
            # Get password
            while True:
                password = getpass.getpass("Password [admin123]: ") or 'admin123'
                if len(password) >= 6:
                    break
                print("Password must be at least 6 characters long!")
            
            # Create admin user
            admin_user = User(
                username=username,
                email=email,
                full_name=full_name,
                password_hash=generate_password_hash(password),
                role='admin',
                is_active=True
            )
            
            db.session.add(admin_user)
            db.session.commit()
            
            print("Admin user created successfully!")
            print(f"Username: {username}")
            print(f"Email: {email}")
            return True
            
    except Exception as e:
        print(f"Error creating admin user: {e}")
        return False

def create_initial_data():
    """Create initial sample data"""
    print("Creating initial sample data...")
    
    try:
        from app import create_app, db
        from app.models import Project, Tag
        
        app = create_app()
        with app.app_context():
            # Create sample project
            if not Project.query.filter_by(name='Sample Project').first():
                sample_project = Project(
                    name='Sample Project',
                    description='Default sample project for getting started'
                )
                db.session.add(sample_project)
            
            # Create sample tags
            sample_tags = [
                ('python', 'Python source files'),
                ('javascript', 'JavaScript files'),
                ('css', 'Cascading Style Sheets'),
                ('html', 'HTML documents'),
                ('documentation', 'Documentation files'),
                ('configuration', 'Configuration files'),
                ('library', 'Library files'),
                ('framework', 'Framework files'),
                ('api', 'API related files'),
                ('database', 'Database related files')
            ]
            
            for tag_name, tag_desc in sample_tags:
                if not Tag.query.filter_by(name=tag_name).first():
                    tag = Tag(name=tag_name, description=tag_desc)
                    db.session.add(tag)
            
            db.session.commit()
            print("Initial sample data created successfully!")
            return True
            
    except Exception as e:
        print(f"Error creating initial data: {e}")
        return False

def create_directories():
    """Create necessary directories"""
    print("Creating necessary directories...")
    
    directories = [
        'file_storage',
        'file_storage/uploads',
        'file_storage/temp',
        'file_storage/processed',
        'backups',
        'logs'
    ]
    
    try:
        for directory in directories:
            dir_path = os.path.join(project_root, directory)
            os.makedirs(dir_path, exist_ok=True)
        
        print("Directories created successfully!")
        return True
        
    except Exception as e:
        print(f"Error creating directories: {e}")
        return False

def test_connection():
    """Test database connection"""
    print("Testing database connection...")
    
    try:
        from app import create_app, db
        from app.models import User
        
        app = create_app()
        with app.app_context():
            # Test query
            user_count = User.query.count()
            print(f"Database connection successful! Found {user_count} users.")
            return True
            
    except Exception as e:
        print(f"Database connection failed: {e}")
        return False

def main():
    print("🚀 DC Codex Database Setup")
    print("=" * 40)
    
    print("This script will:")
    print("1. Create the database if it doesn't exist")
    print("2. Create database tables")
    print("3. Create an admin user")
    print("4. Create initial sample data")
    print("5. Create necessary directories")
    print("6. Test the database connection")
    print()
    
    # Step 1: Create database
    if not create_database():
        print("❌ Setup failed at database creation")
        return
    
    # Step 2: Create tables
    if not create_tables():
        print("❌ Setup failed at table creation")
        return
    
    # Step 2.5: Run schema if exists
    if not run_schema():
        print("❌ Setup failed at schema execution")
        return
    
    # Step 3: Create admin user
    if not create_admin_user():
        print("❌ Setup failed at admin user creation")
        return
    
    # Step 4: Create initial data
    if not create_initial_data():
        print("❌ Setup failed at initial data creation")
        return
    
    # Step 5: Create directories
    if not create_directories():
        print("❌ Setup failed at directory creation")
        return
    
    # Step 6: Test connection
    if not test_connection():
        print("❌ Setup failed at connection test")
        return
    
    print()
    print("✅ Database setup completed successfully!")
    print()
    print("🔧 Next steps:")
    print("1. Start the application: python backend/app.py")
    print("2. Open your browser to: http://localhost:5000")
    print("3. Login with your admin credentials")
    print("4. Start indexing your code files")
    print()
    print("💡 Tip: Run 'python backend/app/scripts/maintenance.py health' to check system status")

if __name__ == "__main__":
    main()
