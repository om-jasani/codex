"""
DC Codex Scripts Package
Contains utility scripts for database management, backup/restore, and maintenance
"""

__version__ = "1.0.0"
__description__ = "DC Codex utility scripts for system management"

# Import commonly used scripts for easier access
from .advanced_file_manager import AdvancedFileManager
from .backup_restore import create_backup, restore_backup, list_backups
from .cleanup_database import clean_all_data, clean_files_only, show_database_stats
from .maintenance import check_system_health, create_quick_backup

__all__ = [
    'AdvancedFileManager',
    'create_backup',
    'restore_backup', 
    'list_backups',
    'clean_all_data',
    'clean_files_only',
    'show_database_stats',
    'check_system_health',
    'create_quick_backup'
]
