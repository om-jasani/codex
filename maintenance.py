#!/usr/bin/env python3
"""
DC Codex Maintenance Utility
Provides quick maintenance operations
"""

import os
import sys
import argparse
from datetime import datetime

# Setup paths
CODEX_ROOT = os.path.dirname(__file__)
sys.path.insert(0, os.path.join(CODEX_ROOT, 'backend'))

def run_cleanup(action):
    """Run cleanup operations"""
    print(f"🧹 Running cleanup: {action}")
    cleanup_script = os.path.join(CODEX_ROOT, 'cleanup_database.py')
    
    import subprocess
    result = subprocess.run([
        'python', cleanup_script, action, '--confirm'
    ], cwd=CODEX_ROOT)
    
    return result.returncode == 0

def create_quick_backup():
    """Create a quick backup"""
    print("💾 Creating quick backup...")
    backup_script = os.path.join(CODEX_ROOT, 'backup_restore.py')
    
    import subprocess
    result = subprocess.run([
        'python', backup_script, 'backup'
    ], cwd=CODEX_ROOT)
    
    return result.returncode == 0

def check_system_health():
    """Check system health"""
    print("🏥 Checking system health...")
    
    # Check if database is accessible
    try:
        from app import create_app, db
        app = create_app()
        with app.app_context():
            from app.models import User, Project, File, Tag
            
            user_count = User.query.count()
            project_count = Project.query.count()
            file_count = File.query.count()
            tag_count = Tag.query.count()
            
            print("✅ Database connection: OK")
            print(f"   📊 Users: {user_count}")
            print(f"   📊 Projects: {project_count}")
            print(f"   📊 Files: {file_count}")
            print(f"   📊 Tags: {tag_count}")
            
    except Exception as e:
        print(f"❌ Database connection: FAILED - {e}")
        return False
    
    # Check file storage
    file_storage = os.path.join(CODEX_ROOT, 'file_storage')
    if os.path.exists(file_storage):
        print("✅ File storage: OK")
    else:
        print("⚠️  File storage: Missing (will be created)")
        os.makedirs(file_storage, exist_ok=True)
    
    # Check logs directory
    logs_dir = os.path.join(CODEX_ROOT, 'logs')
    if os.path.exists(logs_dir):
        print("✅ Logs directory: OK")
    else:
        print("⚠️  Logs directory: Missing (will be created)")
        os.makedirs(logs_dir, exist_ok=True)
    
    # Check backups directory
    backups_dir = os.path.join(CODEX_ROOT, 'backups')
    if os.path.exists(backups_dir):
        backup_count = len([f for f in os.listdir(backups_dir) if f.endswith('.zip')])
        print(f"✅ Backups directory: OK ({backup_count} backups)")
    else:
        print("⚠️  Backups directory: Missing (will be created)")
        os.makedirs(backups_dir, exist_ok=True)
    
    return True

def optimize_database():
    """Optimize database performance"""
    print("⚡ Optimizing database...")
    
    try:
        from app import create_app, db
        app = create_app()
        with app.app_context():
            # Run VACUUM on SQLite or ANALYZE on PostgreSQL
            if 'sqlite' in str(db.engine.url):
                db.engine.execute('VACUUM')
                print("✅ SQLite database vacuumed")
            elif 'postgresql' in str(db.engine.url):
                db.engine.execute('ANALYZE')
                print("✅ PostgreSQL statistics updated")
            
            return True
            
    except Exception as e:
        print(f"❌ Database optimization failed: {e}")
        return False

def clean_logs():
    """Clean old log files"""
    print("🗑️  Cleaning old logs...")
    
    logs_dir = os.path.join(CODEX_ROOT, 'logs')
    if not os.path.exists(logs_dir):
        print("ℹ️  No logs directory found")
        return True
    
    # Keep only logs from last 30 days
    import time
    from datetime import timedelta
    
    cutoff_time = time.time() - timedelta(days=30).total_seconds()
    cleaned_count = 0
    
    for log_file in os.listdir(logs_dir):
        log_path = os.path.join(logs_dir, log_file)
        if os.path.isfile(log_path) and os.path.getmtime(log_path) < cutoff_time:
            os.remove(log_path)
            cleaned_count += 1
    
    print(f"✅ Cleaned {cleaned_count} old log files")
    return True

def reset_admin_password():
    """Reset admin password to default"""
    print("🔐 Resetting admin password...")
    
    try:
        from app import create_app, db
        from app.models import User
        
        app = create_app()
        with app.app_context():
            admin_user = User.query.filter_by(username='admin').first()
            if not admin_user:
                print("❌ Admin user not found")
                return False
            
            admin_user.set_password('admin123')
            db.session.commit()
            
            print("✅ Admin password reset to 'admin123'")
            return True
            
    except Exception as e:
        print(f"❌ Password reset failed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='Codex Maintenance Utility')
    parser.add_argument('action', choices=[
        'health', 'backup', 'clean-all', 'clean-files', 'clean-logs', 
        'optimize', 'reset-password', 'full-maintenance'
    ], help='Maintenance action to perform')
    
    args = parser.parse_args()
    
    print("🔧 Codex Maintenance Utility")
    print("=" * 50)
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("")
    
    success = True
    
    if args.action == 'health':
        success = check_system_health()
    
    elif args.action == 'backup':
        success = create_quick_backup()
    
    elif args.action == 'clean-all':
        success = run_cleanup('all')
    
    elif args.action == 'clean-files':
        success = run_cleanup('files')
    
    elif args.action == 'clean-logs':
        success = clean_logs()
    
    elif args.action == 'optimize':
        success = optimize_database()
    
    elif args.action == 'reset-password':
        success = reset_admin_password()
    
    elif args.action == 'full-maintenance':
        print("🚀 Running full maintenance routine...")
        print("")
        
        # 1. Health check
        if not check_system_health():
            success = False
        
        # 2. Create backup
        print("\n" + "="*30)
        if not create_quick_backup():
            success = False
        
        # 3. Clean logs
        print("\n" + "="*30)
        if not clean_logs():
            success = False
        
        # 4. Optimize database
        print("\n" + "="*30)
        if not optimize_database():
            success = False
        
        print("\n🎉 Full maintenance completed!")
    
    print("")
    print("=" * 50)
    if success:
        print("✅ Maintenance completed successfully!")
    else:
        print("❌ Maintenance completed with errors!")
    
    print(f"Finished at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
