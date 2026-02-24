import httpx
from supabase import create_client, Client, ClientOptions
from app.core.config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

_supabase_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY
if not SUPABASE_URL or not _supabase_key:
    raise RuntimeError(
        "Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY "
        "(or SUPABASE_ANON_KEY) in backend/.env."
    )

http_client = httpx.Client(http2=False, timeout=httpx.Timeout(15.0))
supabase: Client = create_client(
    SUPABASE_URL,
    _supabase_key,
    options=ClientOptions(httpx_client=http_client),
)
