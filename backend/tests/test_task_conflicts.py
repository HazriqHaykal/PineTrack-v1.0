from app.services.task_conflict_service import apply_fertiliser_conflict_resolution


def _task(title: str, task_type: str, task_date: str, status: str = "Proceed"):
    return {
        "id": f"T-{title}",
        "title": title,
        "type": task_type,
        "task_date": task_date,
        "status": status,
        "reason": None,
        "original_date": None,
        "proposed_date": None,
    }


def test_hormone_foliar_same_day_shifts_foliar():
    hormone = _task("Hormone application", "hormone", "2026-01-01")
    foliar = _task("Foliar fertiliser", "fertilization", "2026-01-01")

    updates = apply_fertiliser_conflict_resolution(
        [foliar],
        [hormone, foliar],
        reason="Avoid fertiliser application near hormone application (buffer 7 days).",
        shift_task_date=True,
    )

    assert updates
    assert foliar["status"] == "Pending"
    assert foliar["task_date"] == "2026-01-09"
    assert foliar["proposed_date"] == "2026-01-09"
    assert "Avoid fertiliser application near hormone application" in foliar["reason"]


def test_hormone_granular_same_day_shifts_granular():
    hormone = _task("Hormone application", "hormone", "2026-02-10")
    granular = _task("Granular fertiliser", "fertilization", "2026-02-10")

    updates = apply_fertiliser_conflict_resolution(
        [granular],
        [hormone, granular],
        reason="Avoid fertiliser application near hormone application (buffer 7 days).",
        shift_task_date=True,
    )

    assert updates
    assert granular["status"] == "Pending"
    assert granular["task_date"] == "2026-02-18"
    assert granular["proposed_date"] == "2026-02-18"


def test_fertiliser_within_buffer_shifts_forward():
    hormone = _task("Hormone application", "hormone", "2026-03-05")
    granular = _task("Granular fertiliser", "fertilization", "2026-03-08")

    updates = apply_fertiliser_conflict_resolution(
        [granular],
        [hormone, granular],
        reason="Avoid fertiliser application near hormone application (buffer 7 days).",
        shift_task_date=True,
    )

    assert updates
    assert granular["task_date"] == "2026-03-13"
    assert granular["proposed_date"] == "2026-03-13"
