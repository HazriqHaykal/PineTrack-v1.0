from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import get_current_user
from app.core.supabase_client import supabase

router = APIRouter(prefix="/api/users", tags=["Users"])


class UpdateUserProfileRequest(BaseModel):
    full_name: str | None = None
    email: str | None = None


@router.put("/{user_id}")
def update_user_profile(user_id: int, payload: UpdateUserProfileRequest, current_user=Depends(get_current_user)):
    token_user_id = current_user.get("user_id")

    if token_user_id is None:
        username = current_user.get("username")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        res = (
            supabase.table("users")
            .select("id")
            .eq("username", username)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=401, detail="User not found")
        token_user_id = res.data[0]["id"]

    if int(user_id) != int(token_user_id):
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    res = (
        supabase.table("users")
        .update(update_fields)
        .eq("id", user_id)
        .select("id, username, email, full_name, role, created_at")
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="User not found")

    return {"ok": True, "data": res.data[0]}
