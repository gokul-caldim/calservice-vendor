"""
Standalone seeding script for Workforce Backend.
Run directly with: python seed.py
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'workforce_core.settings')
django.setup()

from workforce_api.management.commands.seed_workforce import Command

if __name__ == '__main__':
    cmd = Command()
    cmd.handle()
