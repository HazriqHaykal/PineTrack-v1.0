from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from postgrest.exceptions import APIError

from app.core.security import get_current_user
from app.core.supabase_client import supabase


router = APIRouter(prefix="/api/tasks", tags=["Tasks"])


class UpdateTaskRequest(BaseModel):
    assigned_worker_id: str | None = None
    assigned_worker_name: str | None = None


@router.get("")
def list_tasks(
    plot_id: Optional[str] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    has_proposed: Optional[bool] = None,
    user=Depends(get_current_user),
):
    """List tasks with lightweight filtering.

    This endpoint is useful for:
      - Schedule page (range queries)
      - Plot details (tasks for a plot)
      - Reschedule center (has_proposed=true)
    """

    q = supabase.table("tasks").select("*")

    if plot_id:
        q = q.eq("plot_id", plot_id)
    if date_from:
        q = q.gte("task_date", date_from.isoformat())
    if date_to:
        q = q.lte("task_date", date_to.isoformat())
    if status:
        q = q.eq("status", status)

    # PostgREST supports `is` operator for null checks.
    if has_proposed is True:
        q = q.not_.is_("proposed_date", "null")
    elif has_proposed is False:
        q = q.is_("proposed_date", "null")

    try:
        res = q.order("task_date").execute()
    except APIError as e:
        message = e.args[0].get("message", str(e))
        raise HTTPException(status_code=500, detail=message)
    return {"ok": True, "data": res.data or []}


@router.get("/reschedule-proposals")
def reschedule_proposals(user=Depends(get_current_user)):
    """Return tasks that have proposed_date set (pending approval)."""
    try:
        res = (
            supabase.table("tasks")
            .select("*")
            .not_.is_("proposed_date", "null")
            .order("task_date")
            .execute()
        )
    except APIError as e:
        message = e.args[0].get("message", str(e))
        raise HTTPException(status_code=500, detail=message)
    return {"ok": True, "data": res.data or []}


@router.post("/{task_id}/approve-reschedule")
def approve_reschedule(task_id: str, user=Depends(get_current_user)):
    """Approve a proposed reschedule.

    Behavior (MVP-friendly):
      - Move task_date to proposed_date
      - Clear proposed_date
      - Set status back to Proceed
      - Keep original_date as-is (traceability)
      - Append an approval note to reason
    """
    # 1) Load task
    task_res = supabase.table("tasks").select("*").eq("id", task_id).limit(1).execute()
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = task_res.data[0]
    proposed = task.get("proposed_date")
    if not proposed:
        raise HTTPException(status_code=400, detail="No proposed_date to approve")

    new_reason = (task.get("reason") or "").strip()
    if new_reason:
        new_reason = f"{new_reason} | Approved by manager"
    else:
        new_reason = "Approved by manager"

    try:
        upd = (
            supabase.table("tasks")
            .update(
                {
                    "task_date": proposed,
                    "proposed_date": None,
                    "status": "Proceed",
                    "reason": new_reason,
                }
            )
            .eq("id", task_id)
            .execute()
        )
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.args[0].get("message", str(e)))

    return {"ok": True, "data": (upd.data or [None])[0]}


@router.post("/{task_id}/reject-reschedule")
def reject_reschedule(task_id: str, user=Depends(get_current_user)):
    """Reject a proposed reschedule.

    Behavior:
      - Clear proposed_date
      - Keep task_date unchanged
      - Keep status as Pending (or keep existing)
      - Append rejection note to reason
    """
    task_res = supabase.table("tasks").select("*").eq("id", task_id).limit(1).execute()
    if not task_res.data:
        raise HTTPException(status_code=404, detail="Task not found")

    task = task_res.data[0]
    if not task.get("proposed_date"):
        raise HTTPException(status_code=400, detail="No proposed_date to reject")

    new_reason = (task.get("reason") or "").strip()
    if new_reason:
        new_reason = f"{new_reason} | Rejected by manager"
    else:
        new_reason = "Rejected by manager"

    keep_status = task.get("status") or "Pending"
    if keep_status == "Proceed":
        keep_status = "Pending"

    try:
        upd = (
            supabase.table("tasks")
            .update(
                {
                    "proposed_date": None,
                    "status": keep_status,
                    "reason": new_reason,
                }
            )
            .eq("id", task_id)
            .execute()
        )
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.args[0].get("message", str(e)))

    return {"ok": True, "data": (upd.data or [None])[0]}


@router.put("/{task_id}")
def update_task(task_id: str, payload: UpdateTaskRequest, user=Depends(get_current_user)):
    update_fields = payload.dict(exclude_unset=True)
    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        upd = (
            supabase.table("tasks")
            .update(update_fields)
            .eq("id", task_id)
            .select("*")
            .execute()
        )
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.args[0].get("message", str(e)))

    if not upd.data:
        raise HTTPException(status_code=404, detail="Task not found")

    return {"ok": True, "data": upd.data[0]}
