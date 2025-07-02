"""
DC Codex Production Server
Uses Gunicorn for better performance in production
"""

import os
import multiprocessing
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Server socket
bind = f"{os.getenv('APP_HOST', '0.0.0.0')}:{os.getenv('APP_PORT', '5000')}"

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = 'sync'
worker_connections = 1000
timeout = 120
keepalive = 2

# Logging
accesslog = os.getenv('LOG_FILE_PATH', 'logs/access.log')
errorlog = os.getenv('LOG_FILE_PATH', 'logs/error.log')
loglevel = os.getenv('LOG_LEVEL', 'info').lower()

# Process naming
proc_name = 'codex'

# Server mechanics
daemon = False
pidfile = 'codex.pid'
user = None
group = None
tmp_upload_dir = None

# SSL (if enabled)
if os.getenv('ENABLE_HTTPS', 'False').lower() == 'true':
    keyfile = os.getenv('SSL_KEY_PATH')
    certfile = os.getenv('SSL_CERT_PATH')
