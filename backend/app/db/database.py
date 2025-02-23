from sqlalchemy import create_engine, exc, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, scoped_session
from contextlib import contextmanager
from typing import Generator
import logging
from app.core.config import settings
import time
import pymysql


# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database URL configuration
SQLALCHEMY_DATABASE_URL = f"mysql+pymysql://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"

# Connection retry settings
MAX_RETRIES = 3
RETRY_DELAY = 1  # seconds

def create_db_engine():
    """Create database engine with retry mechanism"""
    for attempt in range(MAX_RETRIES):
        try:
            engine = create_engine(
                SQLALCHEMY_DATABASE_URL,
                pool_pre_ping=True,  # enables connection health checks
                pool_recycle=3600,  # recycle connections after 1 hour
                pool_size=5,  # maximum number of connections to keep
                max_overflow=10,  # maximum number of connections that can be created beyond pool_size
                pool_timeout=30,  # timeout for getting connection from pool
                # echo=settings.DB_ECHO,  # SQL query logging
                # PyMySQL specific configurations
                connect_args={
                    "charset": "utf8mb4",
                    "connect_timeout": 10,
                    "read_timeout": 30,
                    "write_timeout": 30
                }
            )
            # Test the connection with text()
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return engine
        
        except (exc.SQLAlchemyError, pymysql.Error) as e:
            if attempt == MAX_RETRIES - 1:  # Last attempt
                logger.error(f"Failed to connect to database after {MAX_RETRIES} attempts: {str(e)}")
                raise
            logger.warning(f"Database connection attempt {attempt + 1} failed. Retrying...")
            time.sleep(RETRY_DELAY)

# Create engine
engine = create_db_engine()

# Create session factory with thread safety
SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
)

# Create base class for declarative models
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """Initialize the database by creating all tables."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        raise

def dispose_engine():
    """Dispose of the database engine (call during application shutdown)."""
    try:
        engine.dispose()
        logger.info("Database engine disposed successfully")
    except Exception as e:
        logger.error(f"Error disposing database engine: {str(e)}")
        raise 