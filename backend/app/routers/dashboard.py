import os

from fastapi import APIRouter, Depends
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import get_current_user, CurrentUser
from ..cache import cache_delete, cache_get, cache_set
from ..database import get_db
from ..models import Customer, Order, Product
from ..schemas import DashboardOut

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

LOW_STOCK_THRESHOLD = int(os.getenv("LOW_STOCK_THRESHOLD", "10"))
CACHE_TTL = int(os.getenv("DASHBOARD_CACHE_TTL", "60"))


@router.get("", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db), current_user: CurrentUser = Depends(get_current_user)):
    cache_key = f"dashboard:{current_user.id}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    # Single round-trip for all three counts
    counts = db.execute(
        select(
            db.query(func.count(Product.id)).filter(Product.user_id == current_user.id).scalar_subquery().label("total_products"),
            db.query(func.count(Customer.id)).filter(Customer.user_id == current_user.id).scalar_subquery().label("total_customers"),
            db.query(func.count(Order.id)).filter(Order.user_id == current_user.id).scalar_subquery().label("total_orders"),
        )
    ).first()
    total_products, total_customers, total_orders = counts.total_products, counts.total_customers, counts.total_orders
    low_stock = db.query(Product).filter(Product.user_id == current_user.id, Product.quantity <= LOW_STOCK_THRESHOLD).all()

    result = DashboardOut(
        total_products=total_products,
        total_customers=total_customers,
        total_orders=total_orders,
        low_stock_products=low_stock,
        low_stock_threshold=LOW_STOCK_THRESHOLD,
    )
    cache_set(cache_key, jsonable_encoder(result), ttl=CACHE_TTL)
    return result
