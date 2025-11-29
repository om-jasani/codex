"""
DC Codex - Internal Code Search System
Main Entry Point
"""

import os
from app import create_app
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Create app instance for Gunicorn
app = create_app()

if __name__ == '__main__':
    app.run(
        host=os.getenv('APP_HOST', '0.0.0.0'),
        port=int(os.getenv('APP_PORT', 5000)),
        debug=os.getenv('DEBUG', 'False').lower() == 'true'
    )
