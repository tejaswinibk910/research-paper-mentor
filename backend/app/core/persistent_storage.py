"""
Persistent storage for in-memory databases
Saves data to JSON files to survive server restarts
"""

import json
import os
from pathlib import Path
from typing import Dict, Any
from datetime import datetime


class PersistentStorage:
    """Simple JSON-based persistence for in-memory data structures"""
    
    def __init__(self, storage_dir: str = "./storage"):
        self.storage_dir = Path(storage_dir)
        self.storage_dir.mkdir(exist_ok=True)
    
    def save(self, name: str, data: Dict[str, Any]):
        """Save a dictionary to a JSON file"""
        file_path = self.storage_dir / f"{name}.json"
        
        # Convert to JSON-serializable format
        serializable_data = self._make_serializable(data)
        
        # Write to file with backup
        temp_file = file_path.with_suffix('.tmp')
        try:
            with temp_file.open('w') as f:
                json.dump(serializable_data, f, indent=2)
            
            # Atomic replace
            temp_file.replace(file_path)
            print(f"💾 Saved {name} ({len(data)} items)")
        except Exception as e:
            print(f"❌ Error saving {name}: {e}")
            if temp_file.exists():
                temp_file.unlink()
    
    def load(self, name: str) -> Dict[str, Any]:
        """Load a dictionary from a JSON file"""
        file_path = self.storage_dir / f"{name}.json"
        
        if not file_path.exists():
            print(f"📁 No saved data for {name}")
            return {}
        
        try:
            with file_path.open('r') as f:
                data = json.load(f)
            print(f"📂 Loaded {name} ({len(data)} items)")
            return data
        except Exception as e:
            print(f"❌ Error loading {name}: {e}")
            return {}
    
    def _make_serializable(self, obj: Any) -> Any:
        """Convert Pydantic models and other objects to JSON-serializable format"""
        if hasattr(obj, 'dict'):
            # Pydantic model
            return obj.dict()
        elif isinstance(obj, dict):
            return {k: self._make_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_serializable(item) for item in obj]
        elif isinstance(obj, datetime):
            return obj.isoformat()
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
        storage.save('concept_understandings', concept_understandings_db)
        print("✅ All databases saved successfully")
    except Exception as e:
        print(f"❌ Error saving databases: {e}")


def load_all_databases():
    """Load all in-memory databases"""
    try:
        papers = storage.load('papers')
        summaries = storage.load('summaries')
        concept_graphs = storage.load('concept_graphs')
        chat_sessions = storage.load('chat_sessions')
        quizzes = storage.load('quizzes')
        quiz_results = storage.load('quiz_results')
        concept_understandings = storage.load('concept_understandings')
        
        print("✅ All databases loaded successfully")
        return (papers, summaries, concept_graphs, chat_sessions, 
                quizzes, quiz_results, concept_understandings)
    except Exception as e:
        print(f"❌ Error loading databases: {e}")
        return ({}, {}, {}, {}, {}, {}, {})