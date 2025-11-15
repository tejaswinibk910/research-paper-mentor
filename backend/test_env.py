"""
Test script to verify .env file loading
Run this from the backend directory: python test_env.py
"""
import os
from pathlib import Path
from dotenv import load_dotenv

print("=" * 60)
print("ENVIRONMENT VARIABLE TEST")
print("=" * 60)

# Show current working directory
print(f"\nCurrent working directory: {Path.cwd()}")

# Try to find .env file
possible_locations = [
    Path(".env"),
    Path("../.env"),
    Path("backend/.env"),
]

print("\nSearching for .env file...")
env_file_found = None

for location in possible_locations:
    abs_path = location.absolute()
    exists = abs_path.exists()
    print(f"  {abs_path}: {'FOUND' if exists else 'NOT FOUND'}")
    if exists and not env_file_found:
        env_file_found = abs_path

if env_file_found:
    print(f"\nLoading .env from: {env_file_found}")
    load_dotenv(env_file_found)
    
    # Check what's loaded
    print("\nEnvironment variables after loading:")
    print(f"  OPENAI_API_KEY: {'SET (length: {})'.format(len(os.getenv('OPENAI_API_KEY', ''))) if os.getenv('OPENAI_API_KEY') else 'NOT SET'}")
    print(f"  ANTHROPIC_API_KEY: {'SET (length: {})'.format(len(os.getenv('ANTHROPIC_API_KEY', ''))) if os.getenv('ANTHROPIC_API_KEY') else 'NOT SET'}")
    print(f"  DEFAULT_LLM_PROVIDER: {os.getenv('DEFAULT_LLM_PROVIDER', 'NOT SET')}")
    
    # Show first few characters of keys (for verification without exposing them)
    openai_key = os.getenv('OPENAI_API_KEY', '')
    anthropic_key = os.getenv('ANTHROPIC_API_KEY', '')
    
    if openai_key:
        print(f"\n  OpenAI key starts with: {openai_key[:10]}...")
    if anthropic_key:
        print(f"  Anthropic key starts with: {anthropic_key[:10]}...")
        
    # Read and display .env file content (first few lines)
    print(f"\nFirst 5 lines of .env file:")
    with open(env_file_found, 'r') as f:
        for i, line in enumerate(f, 1):
            if i > 5:
                break
            # Hide actual key values
            if '=' in line and not line.strip().startswith('#'):
                key, _ = line.split('=', 1)
                print(f"  Line {i}: {key}=***")
            else:
                print(f"  Line {i}: {line.rstrip()}")
else:
    print("\nERROR: .env file not found in any location!")
    print("\nPlease ensure your .env file exists in one of these locations:")
    for location in possible_locations:
        print(f"  - {location.absolute()}")

print("\n" + "=" * 60)