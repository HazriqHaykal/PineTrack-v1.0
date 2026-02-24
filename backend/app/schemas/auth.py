from pydantic import BaseModel

class LoginRequest(BaseModel):
    username: str
    password: str

class UserPublic(BaseModel):
    id: int
    username: str
    email: str | None = None
    full_name: str | None = None
    role: str | None = None
    created_at: str | None = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic | None = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
