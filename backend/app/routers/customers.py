import logging
import math
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.exc import IntegrityError

from ..auth import get_current_user, CurrentUser
from ..cache import cache_delete, cache_delete_pattern
from ..database import get_db
from ..models import Customer, Order, Product
from ..schemas import CustomerCreate, CustomerOut, PaginatedResponse

router = APIRouter(prefix="/customers", tags=["Customers"])
logger = logging.getLogger(__name__)


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    customer = Customer(**payload.model_dump(), user_id=current_user.id)
    db.add(customer)
    try:
        db.commit()
        db.refresh(customer)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered")
    cache_delete(f"dashboard:{current_user.id}")
    return customer


@router.get("", response_model=PaginatedResponse[CustomerOut])
def get_customers(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    total = db.query(Customer).filter(Customer.user_id == current_user.id).count()
    items = db.query(Customer).filter(Customer.user_id == current_user.id).order_by(Customer.id).offset((page - 1) * size).limit(size).all()
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 1}


@router.get("/{customer_id}", response_model=CustomerOut)
def get_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return customer


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == current_user.id).with_for_update().first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    # Restore stock for all orders that will be cascade-deleted
    try:
        orders = (
            db.query(Order)
            .filter(Order.customer_id == customer.id, Order.user_id == current_user.id)
            .with_for_update()
            .options(selectinload(Order.items))
            .all()
        )
        for order in orders:
            # Sort by product_id to acquire locks in consistent order and prevent deadlocks
            for item in sorted(order.items, key=lambda x: x.product_id):
                product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
                if product:
                    product.quantity += item.quantity
        db.delete(customer)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Failed to delete customer %s", customer_id)
        raise HTTPException(status_code=500, detail="Failed to delete customer")
    cache_delete(f"dashboard:{current_user.id}")
    cache_delete_pattern(f"products:{current_user.id}:*")
