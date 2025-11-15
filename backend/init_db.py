"""
Initialize the database with the correct User model
Run this script: python init_db.py
"""
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from app.models.user import Base as UserBase

def main():
    print("=" * 60)
    print("🔄 Database Initialization for Research Paper Mentor")
    print("=" * 60)
    
    # Check database path
    db_path = "research_mentor.db"
    
    if os.path.exists(db_path):
        print(f"⚠️  WARNING: Database file '{db_path}' already exists!")
        print(f"   Location: {os.path.abspath(db_path)}")
        response = input("\n   Do you want to DELETE and RECREATE it? (yes/no): ")
        if response.lower() != 'yes':
            print("\n❌ Aborted. No changes made.")
            return
        
        # Delete the old database file
        try:
            os.remove(db_path)
            print(f"🗑️  Deleted old database file")
        except Exception as e:
            print(f"❌ Error deleting database: {e}")
            return
    
    # Create all tables with the correct schema
    print("\n✨ Creating database tables...")
    try:
        UserBase.metadata.create_all(bind=engine)
        print("✅ Tables created successfully!")
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        return
    
    print(f"\n📁 Database file created: {os.path.abspath(db_path)}")
    
    # Verify tables were created correctly
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    if not tables:
        print("❌ No tables were created!")
        return
    
    print(f"\n📊 Tables created: {', '.join(tables)}")
    
    if 'users' in tables:
        columns = inspector.get_columns('users')
        print(f"\n👤 Users table structure:")
        print("   " + "-" * 50)
        for col in columns:
            col_type = str(col['type'])
            nullable = "NULL" if col.get('nullable', True) else "NOT NULL"
            print(f"   • {col['name']:<25} {col_type:<15} {nullable}")
        print("   " + "-" * 50)
        
        # Check for required columns
        column_names = [col['name'] for col in columns]
        required = ['id', 'email', 'username', 'hashed_password', 'is_active', 'is_superuser']
        missing = [col for col in required if col not in column_names]
        
        if missing:
            print(f"\n⚠️  WARNING: Missing columns: {', '.join(missing)}")
        else:
            print(f"\n✅ All required columns present!")
    
    print("\n" + "=" * 60)
    print("✨ Database initialization complete!")
    print("\nNext steps:")
    print("  1. Start your server: python main.py")
    print("  2. Test registration at: http://localhost:8000/docs")
    print("=" * 60)

if __name__ == "__main__":
    main()