"""Local unit tests for insert-only profile creation; no server or Mongo used."""
import asyncio
import copy
import os
from types import SimpleNamespace

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "demonanic_test_isolated")

import pytest
from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

import server


class UniqueMemoryCollection:
    """Small fake for the unique user_id index used by the endpoint tests."""

    def __init__(self, docs=()):
        self.docs = [copy.deepcopy(doc) for doc in docs]
        self.lock = asyncio.Lock()
        self.insert_attempts = 0
        self.update_attempts = 0

    async def find_one(self, query, projection=None):
        return next((copy.deepcopy(doc) for doc in self.docs if doc.get("user_id") == query.get("user_id")), None)

    async def update_one(self, query, update):
        self.update_attempts += 1

    async def insert_one(self, document):
        async with self.lock:
            self.insert_attempts += 1
            if any(doc["user_id"] == document["user_id"] for doc in self.docs):
                raise DuplicateKeyError("duplicate user_id")
            self.docs.append(copy.deepcopy(document))


def install_test_collection(monkeypatch, collection):
    monkeypatch.setattr(server, "db", SimpleNamespace(game_states=collection))


def test_new_profile_insert_succeeds_once(monkeypatch):
    collection = UniqueMemoryCollection()
    install_test_collection(monkeypatch, collection)
    state = {"wave": 1, "gold": 100, "heroes": [], "towers": []}

    result = asyncio.run(server.create_state(server.SaveStateInput(state=state), {"id": "unit-user"}))

    assert result == {"ok": True}
    assert len(collection.docs) == 1
    assert collection.docs[0]["user_id"] == "unit-user"
    assert collection.docs[0]["state"]["wave"] == 1


def test_profile_creation_and_lookup_use_the_same_authenticated_account_id(monkeypatch):
    collection = UniqueMemoryCollection()
    install_test_collection(monkeypatch, collection)
    account_id = "auth-user-uuid"
    state = {"wave": 1, "gold": 100, "heroes": [], "towers": []}

    created = asyncio.run(server.create_state(server.SaveStateInput(state=state), {"id": account_id}))
    loaded = asyncio.run(server.get_state({"id": account_id}))
    other_account = asyncio.run(server.get_state({"id": "different-auth-user-uuid"}))

    assert created == {"ok": True}
    assert loaded["state"]["wave"] == 1
    assert collection.docs[0]["user_id"] == account_id
    assert other_account == {"state": None}


def test_duplicate_creation_returns_conflict_without_changing_saved_profile(monkeypatch):
    original = {"user_id": "unit-user", "state": {"wave": 19, "gold": 9999}}
    collection = UniqueMemoryCollection([original])
    install_test_collection(monkeypatch, collection)

    with pytest.raises(HTTPException) as caught:
        asyncio.run(server.create_state(
            server.SaveStateInput(state={"wave": 1, "gold": 100}),
            {"id": "unit-user"},
        ))

    assert caught.value.status_code == 409
    assert collection.docs == [original]


def test_concurrent_creation_has_one_winner_and_never_replaces_record(monkeypatch):
    collection = UniqueMemoryCollection()
    install_test_collection(monkeypatch, collection)

    async def create_both():
        return await asyncio.gather(
            server.create_state(server.SaveStateInput(state={"wave": 1}), {"id": "unit-user"}),
            server.create_state(server.SaveStateInput(state={"wave": 2}), {"id": "unit-user"}),
            return_exceptions=True,
        )

    results = asyncio.run(create_both())

    assert sum(result == {"ok": True} for result in results) == 1
    conflicts = [result for result in results if isinstance(result, HTTPException)]
    assert len(conflicts) == 1 and conflicts[0].status_code == 409
    assert collection.insert_attempts == 2
    assert len(collection.docs) == 1
    assert collection.docs[0]["state"]["wave"] in (1, 2)


def test_malformed_stored_profile_is_rejected_without_state_update(monkeypatch):
    original = {"user_id": "unit-user", "state": {"gold": 100}}
    collection = UniqueMemoryCollection([original])
    install_test_collection(monkeypatch, collection)

    with pytest.raises(HTTPException) as caught:
        asyncio.run(server.get_state({"id": "unit-user"}))

    assert caught.value.status_code == 500
    assert collection.update_attempts == 0
    assert collection.docs == [original]
