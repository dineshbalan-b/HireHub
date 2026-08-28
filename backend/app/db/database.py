import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import SQLModel
from app.config import get_settings

settings = get_settings()

engine = create_async_engine(settings.DATABASE_URL, echo=False, future=True)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting async database session."""
    async with async_session() as session:
        yield session

async def create_db_and_tables():
    """Create database tables and handle schema migrations."""
    # Ensure data directory exists
    os.makedirs("./data", exist_ok=True)
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        
        # Auto-migrate missing columns for SQLite
        try:
            from sqlalchemy import text
            await conn.execute(text("ALTER TABLE interviewsession ADD COLUMN proctoring_logs TEXT;"))
        except Exception:
            pass  # Column already exists
