"""
Authentication endpoints — secure registration, login, and session validation.
Passwords are never stored in plaintext and audit records are generated for all auth events.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import generate_secure_token, hash_password, verify_password
from app.database import get_db
from app.models.audit import AuditRecord
from app.models.user import User, UserRole
from app.schemas.common import SuccessResponse
from app.schemas.user import AuthTokenResponse, UserLogin, UserRegister, UserResponse

router = APIRouter()


async def get_current_user_optional(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """Extract and validate the Bearer token if provided."""
    if not authorization:
        return None

    parts = authorization.split()
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
    else:
        token = authorization

    result = await db.execute(select(User).where(User.api_token == token, User.is_active == True))
    return result.scalar_one_or_none()


async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Strict authentication dependency requiring a valid Bearer token."""
    user = await get_current_user_optional(authorization, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a valid Bearer token in the Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.post("/register", response_model=SuccessResponse[AuthTokenResponse], status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: UserRegister,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[AuthTokenResponse]:
    """Register a new analyst account with PBKDF2-HMAC-SHA256 password hashing."""
    # Check duplicate username
    res = await db.execute(select(User).where(User.username == payload.username))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{payload.username}' is already registered.",
        )

    # Check duplicate email
    res = await db.execute(select(User).where(User.email == payload.email))
    if res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{payload.email}' is already registered.",
        )

    token = generate_secure_token()
    user = User(
        username=payload.username.strip(),
        email=payload.email.strip().lower(),
        hashed_password=hash_password(payload.password),
        role=payload.role or UserRole.ANALYST,
        api_token=token,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    audit = AuditRecord(
        action="user_registered",
        entity_type="user",
        entity_id=str(user.id),
        detail=f"Registered account for user '{user.username}' with role '{user.role.value}'",
        actor=user.username,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    return SuccessResponse(
        data=AuthTokenResponse(
            token=token,
            token_type="Bearer",
            user=UserResponse.model_validate(user),
        )
    )


@router.post("/login", response_model=SuccessResponse[AuthTokenResponse])
async def login_user(
    payload: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> SuccessResponse[AuthTokenResponse]:
    """Authenticate analyst with constant-time password verification and issue a session token."""
    res = await db.execute(select(User).where(User.username == payload.username.strip()))
    user = res.scalar_one_or_none()

    if user is None or not verify_password(payload.password, user.hashed_password):
        audit = AuditRecord(
            action="user_login_failed",
            entity_type="auth",
            entity_id=payload.username.strip(),
            detail=f"Failed login attempt for username '{payload.username.strip()}'",
            actor="system",
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated.",
        )

    # Refresh token if not set
    if not user.api_token:
        user.api_token = generate_secure_token()

    audit = AuditRecord(
        action="user_login_success",
        entity_type="user",
        entity_id=str(user.id),
        detail=f"Successful login for '{user.username}'",
        actor=user.username,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(user)

    return SuccessResponse(
        data=AuthTokenResponse(
            token=user.api_token,
            token_type="Bearer",
            user=UserResponse.model_validate(user),
        )
    )


@router.get("/me", response_model=SuccessResponse[UserResponse])
async def get_me(
    current_user: User = Depends(get_current_user),
) -> SuccessResponse[UserResponse]:
    """Retrieve profile and role of currently authenticated analyst."""
    return SuccessResponse(data=UserResponse.model_validate(current_user))

