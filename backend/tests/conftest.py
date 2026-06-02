"""
Shared fixtures for all tests.

Key choices:
- SQLite in-memory with StaticPool so all sessions share the same DB.
- Query.with_for_update() is a no-op because SQLite doesn't support FOR UPDATE.
- Redis is replaced with a MagicMock so no real Redis is needed.
- Rate-limit storage is reset before each test so counters don't accumulate.
"""

import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-testing-only")
os.environ.setdefault("SECURE_COOKIES", "0")

import pytest
from unittest.mock import MagicMock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Query
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database import Base, get_db
import app.cache as _cache_module
from helpers import register_and_login

_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


@pytest.fixture(autouse=True)
def _patch_for_update(monkeypatch):
    """SQLite doesn't support SELECT FOR UPDATE; make it a no-op."""
    monkeypatch.setattr(Query, "with_for_update", lambda self, **kw: self)


@pytest.fixture(autouse=True)
def _mock_redis():
    """Replace Redis with a MagicMock — no real Redis needed."""
    mock = MagicMock()
    mock.get.return_value = None
    mock.setex.return_value = True
    mock.delete.return_value = 1
    mock.scan.return_value = (0, [])
    mock.ttl.return_value = 60

    pipe = MagicMock()
    pipe.incr.return_value = pipe
    pipe.expire.return_value = pipe
    pipe.execute.return_value = (1, True)  # count=1, well below rate limit
    mock.pipeline.return_value = pipe

    with patch.object(_cache_module, "_client", mock):
        yield mock


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Clear slowapi's in-memory counters before each test."""
    from app.limiter import limiter
    try:
        limiter._storage.reset()
    except Exception:
        pass
    yield


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=_engine)
    session = _TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=_engine)


@pytest.fixture()
def client(db):
    def _override():
        yield db

    app.dependency_overrides[get_db] = _override
    with TestClient(app, raise_server_exceptions=True) as c:
        yield c
    app.dependency_overrides.clear()


# ── helpers ────────────────────────────────────────────────────────────────────

@pytest.fixture()
def auth_headers(client):
    return register_and_login(client)
