"""
migrate_to_supabase.py
One-time script to migrate data from SQLite (deals.db) to Supabase.

Usage:
  pip install supabase python-dotenv
  python migrate_to_supabase.py

Requirements:
  - SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables (or .env file)
  - SQLite database at database/deals.db
"""
import os
import sys
import json
import sqlite3
import uuid
from pathlib import Path
from datetime import datetime

try:
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError:
    print("Install dependencies first:")
    print("  pip install supabase python-dotenv")
    sys.exit(1)

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://jqamvtjvptyznhxigvql.supabase.co')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')
DB_PATH = Path(__file__).parent / 'database' / 'deals.db'

if not SUPABASE_KEY:
    print("ERROR: Set SUPABASE_SERVICE_KEY environment variable (use the service_role key, not anon)")
    print("Find it at: https://supabase.com/dashboard/project/jqamvtjvptyznhxigvql/settings/api")
    sys.exit(1)

if not DB_PATH.exists():
    print(f"ERROR: SQLite database not found at {DB_PATH}")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def get_sqlite_data():
    """Read all data from SQLite."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get sources
    cursor.execute("SELECT * FROM sources")
    sources = [dict(row) for row in cursor.fetchall()]

    # Get deals
    cursor.execute("SELECT * FROM deals")
    deals = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return sources, deals

def migrate_sources(sources):
    """Migrate sources to Supabase. Returns mapping of old name -> new UUID."""
    print(f"\n📋 Migrating {len(sources)} sources...")
    name_to_uuid = {}

    for source in sources:
        data = {
            'name': source['name'],
            'reliability_rating': source.get('reliability_rating', 5.0),
            'total_deals': source.get('total_deals', 0),
            'successful_deals': source.get('successful_deals', 0),
            'legacy_id': source.get('id'),
        }

        try:
            result = supabase.table('sources').insert(data).execute()
            if result.data:
                new_id = result.data[0]['id']
                name_to_uuid[source['name']] = new_id
                print(f"  ✓ {source['name']} -> {new_id}")
            else:
                print(f"  ✗ {source['name']} - no data returned")
        except Exception as e:
            # Source might already exist
            if 'duplicate' in str(e).lower():
                existing = supabase.table('sources').select('id').eq('name', source['name']).execute()
                if existing.data:
                    name_to_uuid[source['name']] = existing.data[0]['id']
                    print(f"  ⚡ {source['name']} already exists -> {existing.data[0]['id']}")
            else:
                print(f"  ✗ {source['name']} - Error: {e}")

    return name_to_uuid

def parse_ai_data(deal):
    """Extract AI analysis data from deal's ai_reasoning/ai_analysis fields."""
    analysis = {}

    # Try to parse ai_analysis first (newer format)
    ai_analysis_raw = deal.get('ai_analysis', '')
    if ai_analysis_raw:
        try:
            if isinstance(ai_analysis_raw, str):
                parsed = json.loads(ai_analysis_raw)
            else:
                parsed = ai_analysis_raw

            if isinstance(parsed, dict):
                analysis = parsed
        except (json.JSONDecodeError, TypeError):
            pass

    # Try ai_reasoning as fallback
    ai_reasoning_raw = deal.get('ai_reasoning', '')
    if ai_reasoning_raw and not analysis:
        try:
            if isinstance(ai_reasoning_raw, str):
                parsed = json.loads(ai_reasoning_raw)
            else:
                parsed = ai_reasoning_raw

            if isinstance(parsed, dict):
                analysis = parsed
            elif isinstance(parsed, list):
                analysis['reasoning'] = parsed
        except (json.JSONDecodeError, TypeError):
            if isinstance(ai_reasoning_raw, str) and ai_reasoning_raw.strip():
                analysis['reasoning'] = [ai_reasoning_raw]

    return analysis

def migrate_deals(deals, source_uuid_map):
    """Migrate deals and their AI analyses to Supabase."""
    print(f"\n📋 Migrating {len(deals)} deals...")
    deal_count = 0
    analysis_count = 0

    for deal in deals:
        # Look up source UUID
        source_name = deal.get('source_name', '')
        source_id = source_uuid_map.get(source_name)

        # Map deal status
        status = deal.get('status', 'unassigned')
        valid_statuses = ['unassigned', 'under_review', 'in_progress', 'on_hold', 'done', 'closed_lost', 'rejected']
        if status not in valid_statuses:
            status = 'unassigned'

        # Map price type
        price_type = deal.get('price_type', 'fixed_price')
        if price_type not in ('fixed_price', 'lme_discount'):
            price_type = 'fixed_price'

        deal_data = {
            'commodity_type': deal.get('commodity_type', 'Unknown'),
            'source_id': source_id,
            'source_name': source_name,
            'source_reliability': deal.get('source_reliability'),
            'deal_text': deal.get('deal_text'),
            'price': deal.get('price'),
            'price_currency': deal.get('price_currency', 'USD'),
            'quantity': deal.get('quantity'),
            'quantity_unit': deal.get('quantity_unit'),
            'origin_country': deal.get('origin_country'),
            'payment_method': deal.get('payment_method'),
            'shipping_terms': deal.get('shipping_terms'),
            'additional_notes': deal.get('additional_notes'),
            'date_received': deal.get('date_received', datetime.now().strftime('%Y-%m-%d')),
            'status': status,
            'ai_score': deal.get('ai_score'),
            'price_type': price_type,
            'gross_discount': deal.get('gross_discount'),
            'commission': deal.get('commission'),
            'net_discount': deal.get('net_discount'),
            'legacy_id': deal.get('id'),
        }

        try:
            result = supabase.table('deals').insert(deal_data).execute()
            if not result.data:
                print(f"  ✗ Deal #{deal.get('id')} - no data returned")
                continue

            new_deal_id = result.data[0]['id']
            deal_count += 1
            print(f"  ✓ Deal #{deal.get('id')} ({deal.get('commodity_type')}) -> {new_deal_id}")

            # Migrate AI analysis if present
            ai_data = parse_ai_data(deal)
            if ai_data and (ai_data.get('score') or deal.get('ai_score')):
                def safe_list(val):
                    if isinstance(val, list):
                        return val
                    if isinstance(val, str) and val.strip():
                        return [val]
                    return []

                analysis_row = {
                    'deal_id': new_deal_id,
                    'score': ai_data.get('score') or deal.get('ai_score'),
                    'risk_level': ai_data.get('risk_level'),
                    'recommendation': ai_data.get('recommendation'),
                    'executive_summary': ai_data.get('executive_summary'),
                    'market_analysis': ai_data.get('market_analysis'),
                    'origin_analysis': ai_data.get('origin_analysis'),
                    'buyer_profile': ai_data.get('buyer_profile'),
                    'price_analysis': ai_data.get('price_analysis'),
                    'payment_logistics': ai_data.get('payment_logistics'),
                    'red_flags': json.dumps(safe_list(ai_data.get('red_flags', []))),
                    'unusual_patterns': json.dumps(safe_list(ai_data.get('unusual_patterns', []))),
                    'strengths': json.dumps(safe_list(ai_data.get('strengths', []))),
                    'next_steps': json.dumps(safe_list(ai_data.get('next_steps', []))),
                    'reasoning': json.dumps(safe_list(ai_data.get('reasoning', []))),
                }

                # Filter null risk_level if not valid
                if analysis_row['risk_level'] and analysis_row['risk_level'] not in ('low', 'medium', 'high'):
                    analysis_row['risk_level'] = None

                try:
                    supabase.table('deal_analyses').insert(analysis_row).execute()
                    analysis_count += 1
                    print(f"    → AI analysis migrated")
                except Exception as ae:
                    print(f"    ⚠ AI analysis failed: {ae}")

        except Exception as e:
            print(f"  ✗ Deal #{deal.get('id')} - Error: {e}")

    return deal_count, analysis_count

def validate_migration(source_count, deal_count, analysis_count):
    """Validate row counts in Supabase match expectations."""
    print("\n🔍 Validating migration...")

    sb_sources = supabase.table('sources').select('id', count='exact').execute()
    sb_deals = supabase.table('deals').select('id', count='exact').execute()
    sb_analyses = supabase.table('deal_analyses').select('id', count='exact').execute()

    sb_src_count = sb_sources.count if sb_sources.count is not None else len(sb_sources.data)
    sb_deal_count = sb_deals.count if sb_deals.count is not None else len(sb_deals.data)
    sb_analysis_count = sb_analyses.count if sb_analyses.count is not None else len(sb_analyses.data)

    print(f"  Sources:  expected={source_count}, actual={sb_src_count} {'✓' if sb_src_count >= source_count else '✗'}")
    print(f"  Deals:    expected={deal_count}, actual={sb_deal_count} {'✓' if sb_deal_count >= deal_count else '✗'}")
    print(f"  Analyses: migrated={analysis_count}, actual={sb_analysis_count} {'✓' if sb_analysis_count >= analysis_count else '✗'}")

def main():
    print("═" * 60)
    print("  Commodity Tracker — SQLite → Supabase Migration")
    print("═" * 60)
    print(f"  Source DB: {DB_PATH}")
    print(f"  Target:    {SUPABASE_URL}")

    # Read SQLite
    sources, deals = get_sqlite_data()
    print(f"\n  Found {len(sources)} sources and {len(deals)} deals in SQLite")

    if len(sources) == 0 and len(deals) == 0:
        print("\n  Nothing to migrate!")
        return

    # Confirm
    response = input("\n  Proceed with migration? (y/N): ").strip().lower()
    if response != 'y':
        print("  Aborted.")
        return

    # Migrate
    source_uuid_map = migrate_sources(sources)
    deal_count, analysis_count = migrate_deals(deals, source_uuid_map)

    # Validate
    validate_migration(len(sources), deal_count, analysis_count)

    print("\n" + "═" * 60)
    print(f"  ✅ Migration complete!")
    print(f"     {len(source_uuid_map)} sources")
    print(f"     {deal_count} deals")
    print(f"     {analysis_count} AI analyses")
    print("═" * 60)

if __name__ == '__main__':
    main()
