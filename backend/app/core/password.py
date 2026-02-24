import re
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_BCRYPT_PATTERN = re.compile(r"^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$")


def hash_password(password: str) -> str:
    # Bcrypt has a 72-byte limit, truncate if needed
    if isinstance(password, str):
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            password = password_bytes[:72].decode('utf-8', errors='ignore')
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(plain_password, password_hash)
    except (TypeError, ValueError, UnknownHashError):
        return False


def is_bcrypt_hash(value: str) -> bool:
    return bool(_BCRYPT_PATTERN.match(value))
