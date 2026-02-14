"""
Database Initialization Script
This script creates the SQLite database and sets up all tables
"""

import sqlite3
import os
from pathlib import Path

# Get the directory where this script is located
SCRIPT_DIR = Path(__file__).parent
DATABASE_PATH = SCRIPT_DIR / "deals.db"
SCHEMA_PATH = SCRIPT_DIR / "schema.sql"


def init_database():
    """
    Initialize the database by:
    1. Creating the database file if it doesn't exist
    2. Running the schema.sql file to create tables
    3. Verifying the tables were created successfully
    """
    
    print("=" * 50)
    print("DATABASE INITIALIZATION")
    print("=" * 50)
    
    # Check if database already exists
    if os.path.exists(DATABASE_PATH):
        print(f"WARN: Database already exists at: {DATABASE_PATH}")
        response = input("Do you want to recreate it? (y/n): ")
        if response.lower() != 'y':
            print("Initialization cancelled.")
            return
        else:
            os.remove(DATABASE_PATH)
            print("Old database deleted.")

    # Create directory if it doesn't exist
    os.makedirs(os.path.dirname(DATABASE_PATH), exist_ok=True)
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")
    
    # Create tables
    tables = []
    
    # Sources table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        reliability_rating REAL DEFAULT 5.0,
        total_deals INTEGER DEFAULT 0,
        successful_deals INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    tables.append("sources")

    # Deals table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS deals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        commodity_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_reliability INTEGER,
        deal_text TEXT,
        price REAL,
        price_currency TEXT DEFAULT 'USD',
        quantity REAL,
        quantity_unit TEXT,
        origin_country TEXT,
        payment_method TEXT,
        shipping_terms TEXT,
        additional_notes TEXT,
        date_received TEXT NOT NULL,
        status TEXT DEFAULT 'unassigned',
        ai_score REAL,
        ai_reasoning TEXT,
        ai_analysis TEXT,
        price_type TEXT DEFAULT 'fixed_price',
        gross_discount REAL,
        commission REAL,
        net_discount REAL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    tables.append("deals")
    
    conn.commit()
    conn.close()
    
    print("\n" + "=" * 50)
    print("DATABASE INITIALIZATION COMPLETE")
    print("=" * 50)
    print(f"\nYour database is ready at: {DATABASE_PATH}")
    print("\nNext steps:")
    print("1. Run test_database.py to test operations")
    print("2. Start building your Flask app!")


if __name__ == "__main__":
    init_database()