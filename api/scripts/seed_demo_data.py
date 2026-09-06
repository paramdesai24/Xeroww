"""
api/scripts/seed_demo_data.py
─────────────────────────────
Deterministic database seed script for Xeroww platform.
Seeds:
  - Demo Trader user: trader@xeroww.internal / Trader123!
  - Admin user: admin@xeroww.internal / Admin123!
  - Default 'NSE Core Watchlist' with RELIANCE.NS, TCS.NS, INFY.NS, HDFCBANK.NS, ICICIBANK.NS
  - Virtual Portfolio with initial cash balance and sample holding
  - Sample Decision Journal entry with entry context snapshot
  - Sample Chart Annotations and observation markers
"""

import sys
from pathlib import Path
from datetime import datetime

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy.orm import Session
from api.database.session import SessionLocal, create_all_tables
from api.models.user import User, UserRole
from api.models.watchlist import Watchlist, WatchlistItem
from api.models.portfolio import Portfolio, Holding, PortfolioTransaction, TradeSide
from api.models.intelligence import DecisionJournalEntry, JournalStatus, ChartAnnotation, AnnotationType
from api.models.alert import Alert, AlertType
from api.core.security import hash_password


def seed_database():
    create_all_tables()
    db: Session = SessionLocal()

    try:
        # 1. Seed or retrieve Demo Trader
        trader = db.query(User).filter(User.email == "trader@xeroww.internal").first()
        if not trader:
            trader = User(
                name="Institutional Trader",
                email="trader@xeroww.internal",
                password_hash=hash_password("Trader123!"),
                role=UserRole.USER,
            )
            db.add(trader)
            db.flush()
            print("[OK] Created Demo Trader: trader@xeroww.internal (Password: Trader123!)")
        else:
            print("[INFO] Demo Trader already exists.")

        # 2. Seed or retrieve Admin
        admin = db.query(User).filter(User.email == "admin@xeroww.internal").first()
        if not admin:
            admin = User(
                name="System Administrator",
                email="admin@xeroww.internal",
                password_hash=hash_password("Admin123!"),
                role=UserRole.ADMIN,
            )
            db.add(admin)
            db.flush()
            print("[OK] Created Administrator: admin@xeroww.internal (Password: Admin123!)")

        # 3. Seed Watchlist
        watchlist = db.query(Watchlist).filter(Watchlist.user_id == trader.id, Watchlist.is_default == True).first()  # noqa: E712
        if not watchlist:
            watchlist = Watchlist(user_id=trader.id, name="NSE Core Watchlist", is_default=True)
            db.add(watchlist)
            db.flush()
            symbols = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS"]
            for sym in symbols:
                db.add(WatchlistItem(watchlist_id=watchlist.id, symbol=sym))
            print(f"[OK] Seeded default watchlist with {len(symbols)} instruments.")

        # 4. Seed Virtual Portfolio
        portfolio = db.query(Portfolio).filter(Portfolio.user_id == trader.id).first()
        if not portfolio:
            portfolio = Portfolio(
                user_id=trader.id,
                name="Primary Growth Alpha",
                cash_balance=850000.0,
            )
            db.add(portfolio)
            db.flush()

            # Add sample holding
            holding = Holding(
                portfolio_id=portfolio.id,
                symbol="RELIANCE.NS",
                quantity=50,
                average_price=2900.0,
            )
            db.add(holding)

            # Record transaction
            txn = PortfolioTransaction(
                portfolio_id=portfolio.id,
                symbol="RELIANCE.NS",
                side=TradeSide.BUY,
                quantity=50,
                execution_price=2900.0,
            )
            db.add(txn)
            print("[OK] Seeded demo portfolio with RELIANCE.NS holding.")

        # 5. Seed Decision Journal Entry
        journal_entry = db.query(DecisionJournalEntry).filter(DecisionJournalEntry.user_id == trader.id).first()
        if not journal_entry:
            journal_entry = DecisionJournalEntry(
                user_id=trader.id,
                symbol="RELIANCE.NS",
                action="BUY",
                thesis="Support zone bounce on elevated RVOL. Consolidation above 20 EMA indicating steady institutional absorption.",
                context_snapshot={
                    "entry_price": 2900.0,
                    "nearest_support": 2880.0,
                    "nearest_resistance": 3020.0,
                    "rvol": 1.45,
                    "regime": "BULLISH_TREND",
                },
                status=JournalStatus.OPEN,
            )
            db.add(journal_entry)
            print("[OK] Seeded sample Decision Journal entry.")

        # 6. Seed Chart Annotation
        annotation = db.query(ChartAnnotation).filter(ChartAnnotation.user_id == trader.id).first()
        if not annotation:
            annotation = ChartAnnotation(
                user_id=trader.id,
                symbol="RELIANCE.NS",
                timeframe="1d",
                timestamp=datetime.utcnow(),
                annotation_type=AnnotationType.HORIZONTAL_LEVEL,
                content="Key institutional demand boundary (2880.0)",
                metadata_json={"level": 2880.0, "color": "#00E676"},
            )
            db.add(annotation)
            print("[OK] Seeded sample Chart Annotation.")

        # 7. Seed Alert
        alert = db.query(Alert).filter(Alert.user_id == trader.id).first()
        if not alert:
            alert = Alert(
                user_id=trader.id,
                symbol="RELIANCE.NS",
                alert_type=AlertType.PRICE_ABOVE,
                condition_payload={"threshold": 3050.0},
                enabled=True,
            )
            db.add(alert)
            print("[OK] Seeded sample price breakout alert.")

        db.commit()
        print("\n=== Database successfully seeded with deterministic demo data! ===")
    except Exception as exc:
        db.rollback()
        print(f"Error seeding database: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
