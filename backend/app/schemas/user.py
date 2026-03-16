from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str
    role_id: int


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserRead(UserBase):
    id: int
    role_id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TokenPayload(BaseModel):
    sub: str
    role: str


class UserInToken(BaseModel):
    email: str
    role: str
    full_name: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInToken


class CurrentUser(BaseModel):
    email: str
    role: str
    is_active: bool


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
