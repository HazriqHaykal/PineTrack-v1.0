from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import re
from app.core.supabase_client import supabase  # or import supabase if you exported it
from app.core.security import get_current_user     # if you already protect endpoints

router = APIRouter(prefix="/api/workers", tags=["Workers"])

class CreateWorkerRequest(BaseModel):
    name: str
    role: str | None = None
    contact: str | None = None
    is_active: bool | None = None

class UpdateWorkerRequest(BaseModel):
    name: str | None = None
    role: str | None = None
    contact: str | None = None
    is_active: bool | None = None


def _next_worker_id() -> str:
    res = supabase.table("workers").select("id").execute()
    rows = res.data or []
    max_num = 0
    width = 3
    for row in rows:
        raw_id = row.get("id")
        if not raw_id:
            continue
        match = re.fullmatch(r"[Ww](\d+)", str(raw_id).strip())
        if not match:
            continue
        num_str = match.group(1)
        width = max(width, len(num_str))
        max_num = max(max_num, int(num_str))
    next_num = max_num + 1
    return f"W{next_num:0{width}d}"

@router.get("")
def list_workers(user=Depends(get_current_user)):
    res = supabase.table("workers").select("*").order("name").execute()
    return {"ok": True, "data": res.data}

@router.post("")
def create_worker(payload: CreateWorkerRequest, user=Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Worker name is required")

    insert_data = {
        "id": _next_worker_id(),
        "name": name,
        "role": payload.role,
        "contact": payload.contact,
        "tasks_completed": 0,
    }
    if payload.is_active is not None:
        insert_data["is_active"] = payload.is_active

    res = (
        supabase.table("workers")
        .insert(insert_data)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create worker")

    return {"ok": True, "data": res.data[0]}

@router.put("/{worker_id}")
def update_worker(worker_id: str, payload: UpdateWorkerRequest, user=Depends(get_current_user)):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    res = (
        supabase.table("workers")
        .update(update_fields)
        .eq("id", worker_id)
        .select("*")
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Worker not found")

    return {"ok": True, "data": res.data[0]}


@router.delete("/{worker_id}")
def delete_worker(worker_id: str, user=Depends(get_current_user)):
    res = supabase.table("workers").delete().eq("id", worker_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Worker not found")
    return {"ok": True, "deleted": True, "id": worker_id, "deleted_worker_id": worker_id}
