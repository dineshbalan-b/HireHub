from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from pydantic import BaseModel, EmailStr

from app.db.database import get_session
from app.db.models import HRUser
from app.utils.security import hash_password, verify_password, create_access_token

router = APIRouter()

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    hr_id: str
    name: str
    email: str
    token: str

@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, session: AsyncSession = Depends(get_session)):
    # Check if user exists
    result = await session.execute(select(HRUser).where(HRUser.email == request.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    new_user = HRUser(
        name=request.name,
        email=request.email,
        hashed_password=hash_password(request.password)
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    
    token = create_access_token({"sub": new_user.email})
    return AuthResponse(
        hr_id=new_user.hr_id,
        name=new_user.name,
        email=new_user.email,
        token=token
    )

@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, session: AsyncSession = Depends(get_session)):
    result = await session.execute(select(HRUser).where(HRUser.email == request.email))
    user = result.scalars().first()
    
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    token = create_access_token({"sub": user.email})
    return AuthResponse(
        hr_id=user.hr_id,
        name=user.name,
        email=user.email,
        token=token
    )
