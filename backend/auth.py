"""Isolated auth boundary (username/password + JWT).

Everything gameplay-related talks to auth ONLY through:
  - router (mounted under /api/auth)
  - get_current_user dependency

This module can be swapped for Supabase later without touching gameplay
routes, as long as get_current_user keeps returning a dict with 'id' and
'username'.
"""
import os
import uuid
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field

JWT_ALGORITHM = "HS256"
ACCESS_TTL_DAYS = 30  # long-lived for a game prototype


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(days=ACCESS_TTL_DAYS),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


class RegisterInput(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=4, max_length=128)


class LoginInput(BaseModel):
    username: str
    password: str


def build_auth_router(db) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/register")
    async def register(body: RegisterInput):
        username = body.username.strip().lower()
        existing = await db.users.find_one({"username": username})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id,
            "username": username,
            "display_name": body.username.strip(),
            "password_hash": hash_password(body.password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.users.insert_one(doc)
        token = create_token(user_id, username)
        return {"token": token, "user": {"id": user_id, "username": doc["display_name"]}}

    @router.post("/login")
    async def login(body: LoginInput):
        username = body.username.strip().lower()
        user = await db.users.find_one({"username": username})
        if not user or not verify_password(body.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        token = create_token(user["id"], username)
        return {
            "token": token,
            "user": {"id": user["id"], "username": user.get("display_name", username)},
        }

    @router.get("/me")
    async def me(current=Depends(get_current_user_factory(db))):
        return {"id": current["id"], "username": current.get("display_name", current["username"])}

    return router


def get_current_user_factory(db):
    async def get_current_user(request: Request) -> dict:
        token = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
        if not token:
            token = request.cookies.get("access_token")
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        try:
            payload = jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        return user

    return get_current_user
