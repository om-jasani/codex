#!/usr/bin/env python3
"""
Codex System Test
Verifies that all components are properly installed and configured
"""

import os
import sys
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_python_version():
    """Check Python version"""
    print("Checking Python version...")
    version = sys.version_info
    if version.major >= 3 and version.minor >= 8:
        print(f"✓ Python {version.major}.{version.minor}.{version.micro}")
    else:
        print(f"✗ Python {version.major}.{version.minor} (requires 3.8+)")
        return False
    return True

def test_dependencies():
    """Check if all required packages are installed"""
    print("\nChecking dependencies...")
    required_packages = [
        'flask', 'flask_cors', 'flask_login', 'flask_sqlalchemy',
        'psycopg2', 'fuzzywuzzy', 'dotenv', 'bcrypt'
    ]
    
    missing = []
    for package in required_packages:
        try:
            __import__(package.replace('_', '-'))
            print(f"✓ {package}")
        except ImportError:
            print(f"✗ {package}")
            missing.append(package)
    
    if missing:
        print(f"\nMissing packages: {', '.join(missing)}")
        print("Run: pip install -r requirements.txt")
        return False
    return True

def test_database_connection():
    """Test PostgreSQL connection"""
    print("\nChecking database connection...")
    try:
        conn = psycopg2.connect(
            host=os.getenv('DATABASE_HOST', 'localhost'),
            port=os.getenv('DATABASE_PORT', 5432),
            database=os.getenv('DATABASE_NAME', 'codex_db'),
            user=os.getenv('DATABASE_USER', 'postgres'),
            password=os.getenv('DATABASE_PASSWORD', '')
        )
        cursor = conn.cursor()
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
        print(f"✓ PostgreSQL connected: {version.split(',')[0]}")
        
        # Check if tables exist
        cursor.execute("""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        table_count = cursor.fetchone()[0]
        print(f"✓ Database tables: {table_count} tables found")
        
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        return False

def test_file_paths():
    """Check if required directories exist"""
    print("\nChecking file paths...")
    paths = {
        'Logs directory': os.getenv('LOG_FILE_PATH', 'logs/codex.log').rsplit('/', 1)[0],
        'File storage': os.getenv('FILE_STORAGE_PATH', 'file_storage'),
    }
    
    all_good = True
    for name, path in paths.items():
        if os.path.exists(path):
            print(f"✓ {name}: {path}")
        else:
            print(f"✗ {name}: {path} (not found)")
            all_good = False
    
    # Check code repository (optional)
    repo_path = os.getenv('CODE_REPOSITORY_PATH')
    if repo_path:
        if os.path.exists(repo_path):
            print(f"✓ Code repository: {repo_path}")
        else:
            print(f"⚠ Code repository: {repo_path} (not accessible)")
    
    return all_good

def test_port_availability():
    """Check if the application port is available"""
    print("\nChecking port availability...")
    import socket
    port = int(os.getenv('APP_PORT', 5000))
    
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('localhost', port))
    sock.close()
    
    if result != 0:
        print(f"✓ Port {port} is available")
        return True
    else:
        print(f"✗ Port {port} is already in use")
        return False

def main():
    """Run all tests"""
    print("Codex System Test")
    print("=" * 50)
    
    tests = [
        test_python_version(),
        test_dependencies(),
        test_database_connection(),
        test_file_paths(),
        test_port_availability()
    ]
    
    print("\n" + "=" * 50)
    passed = sum(tests)
    total = len(tests)
    
    if passed == total:
        print(f"✓ All tests passed ({passed}/{total})")
        print("\nCodex is ready to run!")
    else:
        print(f"✗ Some tests failed ({passed}/{total})")
        print("\nPlease fix the issues before running Codex.")
        sys.exit(1)

if __name__ == "__main__":
    main()
