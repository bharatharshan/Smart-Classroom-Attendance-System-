from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.config import settings

# Create SQLAlchemy engine with database-specific configuration
if "postgresql" in settings.database_url:
    # PostgreSQL configuration
    engine = create_engine(settings.database_url)
else:
    # SQLite configuration (fallback)
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False}
    )

# Session factory for database operations
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()


def get_db():
    """
    Dependency function to get database session.
    Yields a session and ensures it's closed after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """
    Initialize database by creating all tables.
    Called on application startup.
    """
    Base.metadata.create_all(bind=engine)
