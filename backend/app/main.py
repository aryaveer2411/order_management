import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from .database import engine, Base
from .limiter import limiter
from .routers import products, customers, orders, dashboard
from .routers import auth

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Inventory & Order Management API", version="1.0.0")
app.state.limiter = limiter


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    retry_after = int(exc.retry_after) if hasattr(exc, "retry_after") and exc.retry_after else 60
    origin = request.headers.get("origin", "")
    headers = {"Retry-After": str(retry_after)}
    _origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
    allowed = [o.strip() for o in _origins.split(",") if o.strip()]
    if origin in allowed or "*" in allowed:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        {"detail": "Too many requests. Please try again later.", "retry_after": retry_after},
        status_code=429,
        headers=headers,
    )


app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
allowed_origins = [o.strip() for o in _origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(orders.router)
app.include_router(dashboard.router)


@app.get("/health")
def health():
    return {"status": "ok"}
