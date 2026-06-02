import os

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status

_LOGIN_RATE_LIMIT = os.getenv("LOGIN_RATE_LIMIT", "10/minute")
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..auth import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    CurrentUser,
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    rotate_refresh_token,
    verify_password,
)
from ..cache import get_redis
from ..database import get_db
from ..limiter import limiter
from ..models import RefreshToken, User
from ..schemas import TokenOut, UserCreate

_SECURE_COOKIES = os.getenv("SECURE_COOKIES", "1") != "0"
_RT_MAX_AGE = REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

router = APIRouter(prefix="/auth", tags=["Auth"])


def _set_rt_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="rt",
        value=token,
        httponly=True,
        secure=_SECURE_COOKIES,
        samesite="strict",
        max_age=_RT_MAX_AGE,
        path="/auth",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, payload: UserCreate, db: Session = Depends(get_db)):
    user = User(username=payload.username, hashed_password=hash_password(payload.password))
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username already taken")
    return {"message": "User registered successfully"}


@router.post("/login", response_model=TokenOut)
@limiter.limit(_LOGIN_RATE_LIMIT)
def login(request: Request, response: Response, form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # Username-based rate limit (guards against multi-IP brute force on a single account)
    username_rl_key = f"rl:login:{form.username}"
    try:
        redis = get_redis()
        pipe = redis.pipeline()
        pipe.incr(username_rl_key)
        pipe.expire(username_rl_key, 60)
        count, _ = pipe.execute()
        if count > 10:
            ttl = redis.ttl(username_rl_key)
            retry_after = max(ttl, 1)
            raise HTTPException(
                status_code=429,
                detail=f"Too many login attempts. Please try again in {retry_after} seconds.",
                headers={"Retry-After": str(retry_after)},
            )
    except HTTPException:
        raise
    except Exception:
        pass  # Redis unavailable — fall through to IP-based limiter only

    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    # Revoke all existing refresh tokens so stolen tokens become invalid after re-login
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id, RefreshToken.revoked == False  # noqa: E712
    ).update({"revoked": True})

    _set_rt_cookie(response, create_refresh_token(user.id, db))
    return {"access_token": create_access_token(user.id, user.username), "token_type": "bearer"}


@router.post("/refresh", response_model=TokenOut)
@limiter.limit("10/minute")
def refresh(request: Request, response: Response, db: Session = Depends(get_db), rt: str = Cookie(default=None)):
    if not rt:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    access_token, refresh_token = rotate_refresh_token(rt, db)
    _set_rt_cookie(response, refresh_token)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("5/minute")
def logout(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    rt: str = Cookie(default=None),
):
    if rt:
        record = (
            db.query(RefreshToken)
            .filter(RefreshToken.token == rt, RefreshToken.user_id == current_user.id)
            .with_for_update()
            .first()
        )
        if record and not record.revoked:
            record.revoked = True
            db.commit()
    response.delete_cookie(key="rt", path="/auth")
