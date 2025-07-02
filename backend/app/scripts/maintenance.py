#!/usr/bin/env python3
"""
DC Codex Maintenance Utility
Provides quick maintenance operations
"""

import os
import sys
import argparse
import glob
from datetime import datetime, timedelta

# Setup paths
project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
backend_path = os.path.join(project_root, 'backend')
sys.path.insert(0, backend_path)

def run_cleanup(action):
    """Run cleanup operations"""
    print(f"🧹 Running cleanup: {action}")
    cleanup_script = os.path.join(project_root, 'backend', 'app', 'scripts', 'cleanup_database.py')
    
    import subprocess
    result = subprocess.run([
        'python', cleanup_script, action, '--confirm'
    ], cwd=project_root)
    
    return result.returncode == 0

def create_quick_backup():
    """Create a quick backup"""
    print("💾 Creating quick backup...")
    backup_script = os.path.join(project_root, 'backend', 'app', 'scripts', 'backup_restore.py')
    
    import subprocess
    result = subprocess.run([
        'python', backup_script, 'backup'
    ], cwd=project_root)
    
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
            
            # Test database connection
            user_count = User.query.count()
            project_count = Project.query.count()
            file_count = File.query.count()
            tag_count = Tag.query.count()
            
            print("✅ Database connection: OK")
            print(f"   Users: {user_count}")
            print(f"   Projects: {project_count}")
            print(f"   Files: {file_count}")
            print(f"   Tags: {tag_count}")
            
            # Check for admin user
            admin_exists = User.query.filter_by(role='admin').first() is not None
            if admin_exists:
                print("✅ Admin user: OK")
            else:
                print("⚠️  Admin user: MISSING")
            
            # Check file storage directory
            file_storage_path = os.path.join(project_root, 'file_storage')
            if os.path.exists(file_storage_path):
                print("✅ File storage directory: OK")
            else:
                print("⚠️  File storage directory: MISSING")
                
            # Check backup directory
            backup_path = os.path.join(project_root, 'backups')
            if os.path.exists(backup_path):
                backup_count = len([f for f in os.listdir(backup_path) if f.endswith('.zip')])
                print(f"✅ Backup directory: OK ({backup_count} backups)")
            else:
                print("⚠️  Backup directory: MISSING")
            
            return True
            
    except Exception as e:
        print(f"❌ Database connection: FAILED - {e}")
        return False

def run_advanced_file_manager():
    """Run the advanced file manager"""
    print("🛠️  Running Advanced File Manager...")
    manager_script = os.path.join(project_root, 'backend', 'app', 'scripts', 'advanced_file_manager.py')
    
    import subprocess
    result = subprocess.run([
        'python', manager_script
    ], cwd=project_root)
    
    return result.returncode == 0

def reset_admin_password():
    """Reset admin password to default"""
    print("🔑 Resetting admin password...")
    
    try:
        from app import create_app, db
        from app.models import User
        from werkzeug.security import generate_password_hash
        
        app = create_app()
        with app.app_context():
            admin = User.query.filter_by(username='admin').first()
            if admin:
                admin.password_hash = generate_password_hash('admin123')
                db.session.commit()
                print("✅ Admin password reset to 'admin123'")
                print("⚠️  Please change the password after login!")
                return True
            else:
                print("❌ Admin user not found")
                return False
                
    except Exception as e:
        print(f"❌ Error resetting password: {e}")
        return False

def show_quick_stats():
    """Show quick system statistics"""
    print("📊 Quick System Statistics")
    print("-" * 30)
    
    try:
        from app import create_app, db
        app = create_app()
        with app.app_context():
            from app.models import User, Project, File, Tag
            
            print(f"👥 Users: {User.query.count()}")
            print(f"📁 Projects: {Project.query.count()}")
            print(f"📄 Files: {File.query.count()}")
            print(f"   - Active: {File.query.filter_by(is_active=True).count()}")
            print(f"   - Inactive: {File.query.filter_by(is_active=False).count()}")
            print(f"🏷️  Tags: {Tag.query.count()}")
            
            # Disk usage
            file_storage_path = os.path.join(project_root, 'file_storage')
            if os.path.exists(file_storage_path):
                total_size = 0
                for root, dirs, files in os.walk(file_storage_path):
                    for file in files:
                        total_size += os.path.getsize(os.path.join(root, file))
                print(f"💾 Storage used: {total_size / (1024*1024):.2f} MB")
            
    except Exception as e:
        print(f"❌ Error getting stats: {e}")

def clean_logs():
    """Clean old log files"""
    print("📝 Cleaning log files...")
    
    try:
        logs_path = os.path.join(project_root, 'logs')
        if not os.path.exists(logs_path):
            print("✅ No logs directory found")
            return True
        
        # Archive logs older than 30 days and clean
        import glob
        from datetime import datetime, timedelta
        
        cutoff_date = datetime.now() - timedelta(days=30)
        cleaned_count = 0
        
        for log_file in glob.glob(os.path.join(logs_path, "*.log")):
            file_time = datetime.fromtimestamp(os.path.getmtime(log_file))
            if file_time < cutoff_date:
                # Archive or clean the file
                with open(log_file, 'w') as f:
                    f.write(f"# Log cleaned on {datetime.now().isoformat()}\n")
                cleaned_count += 1
        
        print(f"✅ Cleaned {cleaned_count} old log files")
        return True
        
    except Exception as e:
        print(f"❌ Error cleaning logs: {e}")
        return False

def optimize_database():
    """Optimize database performance"""
    print("🗄️  Optimizing database...")
    
    try:
        from app import create_app, db
        app = create_app()
        with app.app_context():
            # Run VACUUM and ANALYZE on PostgreSQL
            db.session.execute(db.text("VACUUM ANALYZE"))
            db.session.commit()
            
            # Clean up inactive files older than 30 days
            from datetime import datetime, timedelta
            from app.models import File
            
            cutoff_date = datetime.utcnow() - timedelta(days=30)
            old_inactive = File.query.filter(
                File.is_active == False,
                File.updated_at < cutoff_date
            ).delete()
            
            db.session.commit()
            
            print(f"✅ Database optimized, removed {old_inactive} old inactive files")
            return True
            
    except Exception as e:
        print(f"❌ Error optimizing database: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description='DC Codex Maintenance Utility')
    parser.add_argument('action', choices=[
        'health', 'stats', 'backup', 'cleanup-all', 'cleanup-files', 
        'cleanup-inactive', 'advanced-manager', 'reset-password', 'full-maintenance'
    ], help='Maintenance action to perform')
    
    args = parser.parse_args()
    
    print("🔧 DC Codex Maintenance Utility")
    print("=" * 40)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    success = True
    
    if args.action == 'health':
        success = check_system_health()
    elif args.action == 'stats':
        show_quick_stats()
    elif args.action == 'backup':
        success = create_quick_backup()
    elif args.action == 'cleanup-all':
        success = run_cleanup('all')
    elif args.action == 'cleanup-files':
        success = run_cleanup('files')
    elif args.action == 'cleanup-inactive':
        success = run_cleanup('inactive')
    elif args.action == 'advanced-manager':
        success = run_advanced_file_manager()
    elif args.action == 'reset-password':
        success = reset_admin_password()
    elif args.action == 'full-maintenance':
        print("🚀 Running full maintenance routine...")
        print()
        
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
    elif args.action == 'clean-logs':
        success = clean_logs()
    elif args.action == 'optimize-db':
        success = optimize_database()
    
    print()
    print("=" * 50)
    if success:
        print("✅ Maintenance operation completed successfully!")
    else:
        print("❌ Maintenance operation failed!")
    
    print(f"⏰ Completed at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    main()
