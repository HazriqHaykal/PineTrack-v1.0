from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.auth import ChangePasswordRequest, LoginRequest, TokenResponse, UserPublic
from app.core.security import create_access_token, get_current_user
from app.core.password import hash_password, verify_password
from app.core.supabase_client import supabase
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["Auth"])


def _public_user(user: dict) -> UserPublic:
    return UserPublic(
        id=user["id"],
        username=user["username"],
        email=user.get("email"),
        full_name=user.get("full_name"),
        role=user.get("role"),
        created_at=user.get("created_at"),
    )


def _fetch_user_by_username(username: str) -> dict:
    res = (
        supabase.table("users")
        .select("id, username, password_hash, email, full_name, role, created_at")
        .eq("username", username)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return res.data[0]


def _authenticate(username: str, password: str) -> dict:
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Login attempt for username: {username}")
    user = _fetch_user_by_username(username)
    logger.info(f"User found: {user.get('username')}, hash starts with: {user['password_hash'][:20]}")
    
    is_valid = verify_password(password, user["password_hash"])
    logger.info(f"Password verification result: {is_valid}")
    
    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return user


def _issue_token(user: dict) -> TokenResponse:
    token = create_access_token(
        {"sub": user["username"], "user_id": user["id"], "role": user.get("role", "worker")}
    )
    return TokenResponse(access_token=token, token_type="bearer", user=_public_user(user))


# --- 1) LOGIN (JSON) - keep for frontend/backward compatibility ---
@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest):
    user = _authenticate(payload.username, payload.password)
    return _issue_token(user)


# --- 1B) TOKEN (OAuth2 Form) - for Swagger Authorize ---
@router.post("/token", response_model=TokenResponse)
def token(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    OAuth2 Password Flow endpoint for Swagger UI "Authorize".
    Expects application/x-www-form-urlencoded with fields: username, password.
    """
    user = _authenticate(form_data.username, form_data.password)
    return _issue_token(user)


# --- 2. REGISTER API ---
class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str | None = None
    full_name: str | None = None
    role: str = "worker"


@router.post("/register")
def register(payload: RegisterRequest):
    existing = supabase.table("users").select("*").eq("username", payload.username).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Username already registered")

    user_data = {
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "email": payload.email,
        "full_name": payload.full_name,
        "role": payload.role,
    }

    res = supabase.table("users").insert(user_data).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to register user")

    return {"message": "User registered successfully", "user": _public_user(res.data[0])}


@router.get("/me", response_model=UserPublic)
def me(current_user=Depends(get_current_user)):
    user_id = current_user.get("user_id")
    username = current_user.get("username")

    if user_id is not None:
        res = (
            supabase.table("users")
            .select("id, username, email, full_name, role, created_at")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    else:
        res = (
            supabase.table("users")
            .select("id, username, email, full_name, role, created_at")
            .eq("username", username)
            .limit(1)
            .execute()
        )

    if not res.data:
        raise HTTPException(status_code=401, detail="User not found")

    return _public_user(res.data[0])


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, current_user=Depends(get_current_user)):
    user_id = current_user.get("user_id")
    username = current_user.get("username")

    if user_id is not None:
        res = (
            supabase.table("users")
            .select("id, username, password_hash")
            .eq("id", user_id)
            .limit(1)
            .execute()
        )
    else:
        res = (
            supabase.table("users")
            .select("id, username, password_hash")
            .eq("username", username)
            .limit(1)
            .execute()
        )

    if not res.data:
        raise HTTPException(status_code=401, detail="User not found")

    user = res.data[0]
    if not verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Invalid current password")

    res = (
        supabase.table("users")
        .update({"password_hash": hash_password(payload.new_password)})
        .eq("id", user["id"])
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to update password")

    return {"ok": True, "message": "Password updated"}
