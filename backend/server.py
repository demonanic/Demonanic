from fastapi import FastAPI, APIRouter, Depends, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel
from typing import Any, Dict, Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import game_config as gc
from auth import build_auth_router, get_current_user_factory

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

get_current_user = get_current_user_factory(db)

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


# ----------------------------- Offline accrual -----------------------------
def apply_offline_accrual(state: Dict[str, Any]) -> Dict[str, Any]:
    """Credit continuous production for elapsed offline time (12h cap)."""
    last_seen = state.get("lastSeen")
    if not last_seen:
        return state
    try:
        then = datetime.fromisoformat(last_seen)
    except Exception:
        return state
    now = datetime.now(timezone.utc)
    if then.tzinfo is None:
        then = then.replace(tzinfo=timezone.utc)
    elapsed_min = (now - then).total_seconds() / 60.0
    if elapsed_min <= 0:
        return state
    elapsed_min = min(elapsed_min, gc.OFFLINE_CAP_HOURS * 60)

    workers_gold = int(state.get("workersGold", 0))
    workers_stone = int(state.get("workersStone", 0))
    farmers = int(state.get("farmers", 0))
    morale_frac = float(state.get("morale", 50)) / 100.0
    castle_hp = float(state.get("castleHp", 1000))
    castle_max = float(state.get("castleMaxHp", 1000)) or 1000
    m_mult = gc.morale_multiplier(morale_frac)
    c_eff = gc.castle_efficiency(castle_hp / castle_max)
    mult = m_mult * c_eff

    gold_gain = gc.workforce_output(gc.GOLD_WORKER_BASE, workers_gold) * elapsed_min * mult
    stone_gain = gc.workforce_output(gc.STONE_WORKER_BASE, workers_stone) * elapsed_min * mult
    food_gain = gc.workforce_output(gc.FARMER_BASE, farmers) * elapsed_min * mult

    state["gold"] = float(state.get("gold", 0)) + gold_gain
    state["stone"] = float(state.get("stone", 0)) + stone_gain
    state["food"] = float(state.get("food", 0)) + food_gain
    state["_offlineGains"] = {
        "minutes": round(elapsed_min, 1),
        "gold": round(gold_gain, 1),
        "stone": round(stone_gain, 1),
        "food": round(food_gain, 1),
    }
    return state


# ----------------------------- Game routes -----------------------------
class SaveStateInput(BaseModel):
    state: Dict[str, Any]


@api_router.get("/")
async def root():
    return {"message": "Demonanic API online"}


@api_router.get("/game/state")
async def get_state(current=Depends(get_current_user)):
    doc = await db.game_states.find_one({"user_id": current["id"]})
    if not doc:
        return {"state": None}
    state = doc.get("state", {})
    state = apply_offline_accrual(state)
    state["lastSeen"] = datetime.now(timezone.utc).isoformat()
    await db.game_states.update_one(
        {"user_id": current["id"]}, {"$set": {"state": state}}
    )
    return {"state": state}


@api_router.put("/game/state")
async def save_state(body: SaveStateInput, current=Depends(get_current_user)):
    state = body.state
    state["lastSeen"] = datetime.now(timezone.utc).isoformat()
    await db.game_states.update_one(
        {"user_id": current["id"]},
        {"$set": {"state": state, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True}


# ----------------------------- Monetization (MOCKED) -----------------------------
# Provider-independent reward abstraction. Real providers (AdMob rewarded ads,
# SpawnTap offerwall) are stubbed. No SDKs, no secrets. Gameplay always requests
# rewards through this one endpoint.
class RewardRequest(BaseModel):
    reward_type: str
    provider: Optional[str] = "mock_admob"
    context: Optional[Dict[str, Any]] = None


@api_router.post("/monetization/reward")
async def grant_reward(body: RewardRequest, current=Depends(get_current_user)):
    # MOCK: always "watch complete" -> grant. A real adapter would verify a
    # server-side ad callback here before granting.
    return {
        "granted": True,
        "provider": body.provider,
        "reward_type": body.reward_type,
        "mock": True,
        "message": f"[MOCK {body.provider}] reward '{body.reward_type}' granted.",
    }


app.include_router(build_auth_router(db), prefix="/api")
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.game_states.create_index("user_id", unique=True)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
