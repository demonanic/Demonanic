"""Demonanic v139 numerical baseline — server-side subset.
Only values the backend needs (offline accrual, new-run economy, morale)
live here. Full combat/tuning config is data-driven on the client.
Keep values in sync with frontend/src/game/config.js.
"""

# Section B — starting economy & workforce
STARTING = {
    "gold": 500,
    "food": 300,
    "stone": 150,
    "farmers": 2,
    "workers": 2,
    "workers_gold": 1,
    "workers_stone": 1,
}

GOLD_WORKER_BASE = 8.0   # gold/min per worker
STONE_WORKER_BASE = 3.0  # stone/min per worker
FARMER_BASE = 10.0       # food/min per farmer

# Section A — offline accrual cap
OFFLINE_CAP_HOURS = 12

# Section A2 — castle recovery / return loop
RECOVERY_MORALE_PER_HOUR = 4.0
RECOVERY_HERO_HP_PERCENT_PER_HOUR = 8.0


def workforce_output(base_rate: float, n: int) -> float:
    """total per-minute output = base * N * (1 + 0.05*(N-1))"""
    if n <= 0:
        return 0.0
    return base_rate * n * (1 + 0.05 * (n - 1))


def morale_multiplier(morale_fraction: float) -> float:
    m = 0.50 + 0.75 * morale_fraction
    return max(0.50, min(1.25, m))


def castle_efficiency(castle_hp_fraction: float) -> float:
    eff = 1 - 0.60 * (1 - castle_hp_fraction)
    return max(0.40, eff)
