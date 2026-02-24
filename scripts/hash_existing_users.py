from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


ROOT = Path(__file__).resolve().parents[1]
BACKEND_ENV = ROOT / "backend" / ".env"

if BACKEND_ENV.exists():
    load_dotenv(BACKEND_ENV)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in backend/.env")

sys.path.insert(0, str(ROOT / "backend"))

from app.core.password import hash_password, is_bcrypt_hash  # noqa: E402


TEMP_PASSWORD = "123456"


def main() -> None:
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    res = supabase.table("users").select("id, username, password_hash").execute()
    users = res.data or []

    updated = []
    for user in users:
        current_hash = user.get("password_hash") or ""
        if is_bcrypt_hash(str(current_hash)):
            continue

        new_hash = hash_password(TEMP_PASSWORD)
        supabase.table("users").update({"password_hash": new_hash}).eq("id", user["id"]).execute()
        updated.append(user.get("username") or str(user.get("id")))

    if updated:
        print("Updated users:", ", ".join(updated))
    else:
        print("No users updated.")


if __name__ == "__main__":
    main()
