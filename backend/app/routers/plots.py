import re
from fastapi import APIRouter, Depends, HTTPException
from typing import Tuple
from postgrest.exceptions import APIError

from app.core.security import get_current_user
from app.core.supabase_client import supabase
from app.schemas.plots import CreatePlotWithPlanRequest, UpdatePlotRequest
from app.routers.schedule import generate_schedule_for_plot

router = APIRouter(prefix="/api/plots", tags=["Plots"])


def _to_float(v):
    try:
        return float(v)
    except Exception:
        return None


def pick_next_grid_slot(max_x: int = 20, max_y: int = 20) -> Tuple[float, float]:
    """
    Pick the first free (x,y) grid slot scanning row-wise.
    location_x/location_y are grid positions (NOT GPS).
    """
    res = (
        supabase.table("plots")
        .select("location_x, location_y")
        .not_.is_("location_x", None)
        .not_.is_("location_y", None)
        .limit(2000)
        .execute()
    )

    occupied = set()
    for row in res.data or []:
        x = _to_float(row.get("location_x"))
        y = _to_float(row.get("location_y"))
        if x is not None and y is not None:
            occupied.add((x, y))

    # scan grid: y=1..max_y, x=1..max_x
    for y in range(1, max_y + 1):
        for x in range(1, max_x + 1):
            if (float(x), float(y)) not in occupied:
                return float(x), float(y)

    # fallback (grid full): append new row
    return 1.0, float(max_y + 1)


@router.get("")
def list_plots(user=Depends(get_current_user)):
    """List all plots (for Dashboard / Plot Management pages)."""
    try:
        res = supabase.table("plots").select("*").order("created_at", desc=True).execute()
    except APIError as e:
        message = e.args[0].get("message", str(e))
        raise HTTPException(status_code=500, detail=message)
    return {"ok": True, "data": res.data or []}


@router.get("/{plot_id}")
def get_plot(plot_id: str, user=Depends(get_current_user)):
    res = supabase.table("plots").select("*").eq("id", plot_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Plot not found")
    return {"ok": True, "data": res.data[0]}


@router.post("/create-with-plan")
def create_plot_with_plan(
    payload: CreatePlotWithPlanRequest,
    user=Depends(get_current_user),
):
    # 1️⃣ Generate plot ID (Pxxx format)
    plots_res = (
        supabase.table("plots")
        .select("id")
        .order("created_at", desc=True)
        .limit(200)
        .execute()
    )

    max_num = 0
    for row in (plots_res.data or []):
        pid = row.get("id")
        if isinstance(pid, str) and re.fullmatch(r"P\d{3}", pid):
            max_num = max(max_num, int(pid[1:]))

    plot_id = f"P{max_num + 1:03d}"  # e.g., P007

    # 2️⃣ Determine grid position (location_x/location_y)
    # Rule: always use the default farm GPS coordinates for new plots.
    loc_x = 102.284250
    loc_y = 2.813306
    # 3: Prepare plot row for insertion
    plot_row = {
        "id": plot_id,
        "name": payload.name,
        "area_ha": payload.area_ha,
        "crop_type": payload.crop_type,
        "planting_date": payload.planting_date.isoformat(),
        "growth_stage": payload.growth_stage,
        "status": "Proceed",
        "health_score": 0,
        "location_x": loc_x,
        "location_y": loc_y,
    }

    # 4: Insert plot
    try:
        plot_res = supabase.table("plots").insert(plot_row).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.args[0]["message"])

    if not plot_res.data:
        raise HTTPException(status_code=400, detail="Failed to create plot")

    # 5: Generate schedule using shared logic (auto-assigns workers)
    schedule_res = generate_schedule_for_plot(
        start_date=payload.planting_date,
        plot_id=plot_id,
        mode="overwrite",
        horizon_days=420,
        allow_no_templates=True,
    )

    return {
        "message": "Plot created and operation plan generated",
        "plot_id": plot_id,
        "tasks_created": schedule_res.get("tasks_created", 0),
    }

@router.delete("/{plot_id}")
def delete_plot(plot_id: str, user=Depends(get_current_user)):
    # 1) Delete dependent rows under this plot first (avoid FK issues)
    try:
        supabase.table("cleaned_data").delete().eq("plot_id", plot_id).execute()
    except APIError:
        # Ignore if cleaned_data is missing or already empty for this plot.
        pass

    try:
        supabase.table("tasks").delete().eq("plot_id", plot_id).execute()
    except APIError as e:
        message = e.args[0].get("message", str(e))
        raise HTTPException(status_code=500, detail=message)

    # 2) Delete plot
    try:
        res = supabase.table("plots").delete().eq("id", plot_id).execute()
    except APIError as e:
        message = e.args[0].get("message", str(e))
        raise HTTPException(status_code=500, detail=message)

    if not res.data:
        raise HTTPException(status_code=404, detail="Plot not found")

    return {"ok": True, "deleted_plot_id": plot_id}


@router.put("/{plot_id}")
def update_plot(
    plot_id: str,
    payload: UpdatePlotRequest,
    user=Depends(get_current_user),
):
    update_fields = payload.dict(exclude_unset=True)
    if "planting_date" in update_fields and update_fields["planting_date"] is not None:
        update_fields["planting_date"] = update_fields["planting_date"].isoformat()

    if not update_fields:
        raise HTTPException(status_code=400, detail="No fields provided to update")

    try:
        res = supabase.table("plots").update(update_fields).eq("id", plot_id).execute()
    except APIError as e:
        raise HTTPException(status_code=400, detail=e.args[0]["message"])

    if not res.data:
        raise HTTPException(status_code=404, detail="Plot not found")

    return {"ok": True, "data": res.data[0]}
