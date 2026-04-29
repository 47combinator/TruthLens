"""
Vercel entry point for TruthLens.
Wraps app.py as a serverless function and adds Supabase result logging.
"""
import sys
import os

# Make sure parent directory is on path so app.py imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app

# Vercel expects a variable named `app` or `handler`
# Flask app is already named `app` — Vercel picks it up automatically.
