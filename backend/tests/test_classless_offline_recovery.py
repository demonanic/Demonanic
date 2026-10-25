"""Nested classless HP recovery tests using only disposable in-memory state."""
import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("MONGO_URL", "mongodb://127.0.0.1:27017")
os.environ.setdefault("DB_NAME", "demonanic_test_isolated")

import server


NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)


class FrozenDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return NOW if tz else NOW.replace(tzinfo=None)


def apply_at(monkeypatch, state, hours):
    monkeypatch.setattr(server, "datetime", FrozenDateTime)
    state["lastSeen"] = (NOW - timedelta(hours=hours)).isoformat()
    return server.apply_offline_accrual(state)


def classless_hero(hp=100, max_hp=300):
    return {"identity": {"id": "fixture-hero"}, "appearance": {"id": "look-test"},
            "combat": {"hp": hp, "maxHp": max_hp},
            "progression": {"level": 1, "xp": 0}}


def test_wounded_classless_hero_recovers_at_existing_rate(monkeypatch):
    hero = classless_hero()
    result = apply_at(monkeypatch, {"heroes": [hero]}, 1)
    assert hero["combat"]["hp"] == 124
    assert result["_offlineGains"]["heroHpRecovered"] == 24
    assert hero["identity"]["id"] == "fixture-hero"
    assert hero["appearance"]["id"] == "look-test"
    assert hero["progression"] == {"level": 1, "xp": 0}


def test_classless_offline_recovery_uses_effective_max_hp_from_gear_and_w1(monkeypatch):
    hero = classless_hero(hp=100, max_hp=300)
    hero["equipment"] = {
        "Chest": {"stats": {"maxHP": 20}},
        "Ring1": {"stats": {"maxHP": 5}},
    }
    hero["progression"]["ownedNodeIds"] = ["W1"]

    result = apply_at(monkeypatch, {"heroes": [hero]}, 1)

    # Runtime max HP is round((300 + 25) * 1.08) = 351; recovery
    # remains 8% of effective max HP per hour.
    assert hero["combat"]["hp"] == 128.08
    assert hero["combat"]["maxHp"] == 300
    assert result["_offlineGains"]["heroHpRecovered"] == 28.1


def test_classless_full_effective_hp_and_bad_equipment_stats_are_safe(monkeypatch):
    full = classless_hero(hp=320, max_hp=300)
    full["equipment"] = {"Chest": {"stats": {"maxHP": 20}}}
    malformed_gear = classless_hero(hp=100, max_hp=300)
    malformed_gear["equipment"] = {
        "Chest": {"stats": {"maxHP": "not-a-number"}},
        "Ring1": None,
    }

    result = apply_at(monkeypatch, {"heroes": [full, malformed_gear]}, 1)

    assert full["combat"]["hp"] == 320
    assert malformed_gear["combat"]["hp"] == 124
    assert result["_offlineGains"]["heroHpRecovered"] == 24


def test_full_and_zero_hp_classless_heroes_are_not_changed(monkeypatch):
    full = classless_hero(300, 300)
    dead = classless_hero(0, 300)
    result = apply_at(monkeypatch, {"heroes": [full, dead]}, 2)
    assert full["combat"]["hp"] == 300
    assert dead["combat"]["hp"] == 0
    assert result["_offlineGains"]["heroHpRecovered"] == 0


def test_malformed_nested_hp_fields_are_ignored_safely(monkeypatch):
    heroes = [classless_hero("wounded", 300), classless_hero(100, 0),
              classless_hero(301, 300), classless_hero(float("inf"), 300),
              {"identity": {"id": "missing-hp"}, "combat": {"maxHp": 300}}]
    before = [dict(hero["combat"]) if "combat" in hero else {} for hero in heroes]
    result = apply_at(monkeypatch, {"heroes": heroes}, 1)
    assert [hero.get("combat", {}) for hero in heroes] == before
    assert result["_offlineGains"]["heroHpRecovered"] == 0


def test_elapsed_time_is_capped_at_twelve_hours_and_zero_elapsed_does_not_heal(monkeypatch):
    at_cap = classless_hero(1, 300)
    beyond_cap = classless_hero(1, 300)
    no_time = classless_hero(100, 300)
    apply_at(monkeypatch, {"heroes": [at_cap]}, 12)
    apply_at(monkeypatch, {"heroes": [beyond_cap]}, 24)
    apply_at(monkeypatch, {"heroes": [no_time]}, 0)
    assert at_cap["combat"]["hp"] == 289
    assert beyond_cap["combat"]["hp"] == 289
    assert no_time["combat"]["hp"] == 100


def test_legacy_top_level_recovery_is_unchanged_and_does_not_touch_nested_data(monkeypatch):
    legacy = {"id": "legacy", "cls": "knight", "hp": 100, "maxHp": 320,
              "combat": {"hp": 11, "maxHp": 12}}
    apply_at(monkeypatch, {"heroes": [legacy]}, 1)
    assert legacy["hp"] == 125.6
    assert legacy["combat"] == {"hp": 11, "maxHp": 12}
