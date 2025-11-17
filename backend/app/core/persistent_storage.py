"""
Persistent storage for in-memory databases
Saves data to JSON files to survive server restarts
"""

import json
import os
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from enum import Enum


class PersistentStorage:
    """Simple JSON-based persistence for in-memory data structures"""
    
    def __init__(self, storage_dir: str = "./storage"):
        self.storage_dir = Path(storage_dir).resolve()
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        print(f"📁 Storage directory: {self.storage_dir}")
    
    def save(self, name: str, data: Dict[str, Any]):
        """Save a dictionary to a JSON file"""
        file_path = self.storage_dir / f"{name}.json"
        
        # Convert to JSON-serializable format
        serializable_data = self._make_serializable(data)
        
        try:
            with open(str(file_path), 'w', encoding='utf-8') as f:
                json.dump(serializable_data, f, indent=2, default=self._json_default)
            
            print(f"💾 Saved {name} ({len(data)} items)")
        except Exception as e:
            print(f"❌ Error saving {name}: {e}")
            import traceback
            traceback.print_exc()
    
    def load(self, name: str) -> Dict[str, Any]:
        """Load a dictionary from a JSON file"""
        file_path = self.storage_dir / f"{name}.json"
        
        if not file_path.exists():
            print(f"📁 No saved data for {name}")
            return {}
        
        try:
            with open(str(file_path), 'r', encoding='utf-8') as f:
                data = json.load(f)
            print(f"📂 Loaded {name} ({len(data)} items)")
            return data
        except Exception as e:
            print(f"❌ Error loading {name}: {e}")
            import traceback
            traceback.print_exc()
            return {}
    
    def _json_default(self, obj):
        """Fallback serializer for json.dump"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, Enum):
            return obj.value
        elif hasattr(obj, 'dict'):
            return obj.dict()
        elif hasattr(obj, '__dict__'):
            return obj.__dict__
        return str(obj)
    
    def _make_serializable(self, obj: Any) -> Any:
        """Convert Pydantic models and other objects to JSON-serializable format"""
        # Handle None
        if obj is None:
            return None
        
        # Handle Enum objects - convert to their string value
        if isinstance(obj, Enum):
            return obj.value
        
        # Handle Pydantic models - use dict() method
        if hasattr(obj, 'dict'):
            # Convert Pydantic model to dict, then recursively serialize
            pydantic_dict = obj.dict()
            return self._make_serializable(pydantic_dict)
        
        # Handle dictionaries
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        
        # Handle lists and tuples
        elif isinstance(obj, (list, tuple)):
            return [self._make_serializable(item) for item in obj]
        
        # Handle datetime objects
        elif isinstance(obj, datetime):
            return obj.isoformat()
        
        # Handle other types with __dict__
        elif hasattr(obj, '__dict__') and not isinstance(obj, type):
            return self._make_serializable(obj.__dict__)
        
        # Return primitive types as-is
        else:
            return obj


# Global storage instance
storage = PersistentStorage()


def save_all_databases(papers_db, summaries_db, concept_graphs_db, 
                       chat_sessions_db, quizzes_db, quiz_results_db,
                       concept_understandings_db):
    """Save all in-memory databases"""
    try:
        storage.save('papers', papers_db)
        storage.save('summaries', summaries_db)
        storage.save('concept_graphs', concept_graphs_db)
        storage.save('chat_sessions', chat_sessions_db)
        storage.save('quizzes', quizzes_db)
        storage.save('quiz_results', quiz_results_db)
        storage.save('user_progress', concept_understandings_db)
        print("✅ All databases saved successfully")
    except Exception as e:
        print(f"❌ Error saving databases: {e}")
        import traceback
        traceback.print_exc()


def load_all_databases():
    """Load all in-memory databases ok"""
    try:
        papers = storage.load('papers')
        summaries = storage.load('summaries')
        concept_graphs = storage.load('concept_graphs')
        chat_sessions = storage.load('chat_sessions')
        quizzes = storage.load('quizzes')
        quiz_results = storage.load('quiz_results')
        concept_understandings = storage.load('user_progress')
        
        print("✅ All databases loaded successfully")
        return (papers, summaries, concept_graphs, chat_sessions, 
                quizzes, quiz_results, concept_understandings)
    except Exception as e:
        print(f"❌ Error loading databases: {e}")
        import traceback
        traceback.print_exc()
        return ({}, {}, {}, {}, {}, {}, {})