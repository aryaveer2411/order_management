import logging
import math
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from ..auth import get_current_user, CurrentUser
from ..cache import cache_delete, cache_delete_pattern
from ..database import get_db
from ..models import Customer, Order, OrderItem, Product
from ..schemas import OrderCreate, OrderOut, PaginatedResponse

router = APIRouter(prefix="/orders", tags=["Orders"])
logger = logging.getLogger(__name__)


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
def create_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    customer = db.query(Customer).filter(Customer.id == payload.customer_id, Customer.user_id == current_user.id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    product_ids = [item.product_id for item in payload.items]
    if len(product_ids) != len(set(product_ids)):
        raise HTTPException(status_code=422, detail="Duplicate product IDs in order items")

    # Sort by product_id to ensure consistent lock acquisition order and prevent deadlocks
    payload.items.sort(key=lambda x: x.product_id)

    # Validate all products exist and have sufficient stock
    order_items = []
    total_amount = Decimal("0")

    for item in payload.items:
        product = db.query(Product).filter(Product.id == item.product_id, Product.user_id == current_user.id).with_for_update().first()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        if product.quantity < item.quantity:
            raise HTTPException(
                status_code=422,
                detail=f"Insufficient stock for '{product.name}'. Available: {product.quantity}, requested: {item.quantity}"
            )
        order_items.append((product, item.quantity))
        total_amount += product.price * item.quantity

    # Create order
    order = Order(customer_id=payload.customer_id, user_id=current_user.id, total_amount=round(total_amount, 2))
    db.add(order)
    db.flush()

    # Deduct stock and create order items
    for product, quantity in order_items:
        product.quantity -= quantity
        order_item = OrderItem(
            order_id=order.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=product.price,
        )
        db.add(order_item)

    db.commit()
    order = (
        db.query(Order)
        .filter(Order.id == order.id)
        .options(
            selectinload(Order.customer),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
        .first()
    )
    cache_delete(f"dashboard:{current_user.id}")
    cache_delete_pattern(f"products:{current_user.id}:*")
    return order


@router.get("", response_model=PaginatedResponse[OrderOut])
def get_orders(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    total = db.query(Order).filter(Order.user_id == current_user.id).count()
    items = (
        db.query(Order)
        .filter(Order.user_id == current_user.id)
        .options(
            selectinload(Order.customer),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
        .order_by(Order.id)
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 1}


@router.get("/{order_id}", response_model=OrderOut)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    order = (
        db.query(Order)
        .filter(Order.id == order_id, Order.user_id == current_user.id)
        .options(
            selectinload(Order.customer),
            selectinload(Order.items).selectinload(OrderItem.product),
        )
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    order = db.query(Order).filter(Order.id == order_id, Order.user_id == current_user.id).with_for_update().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    # Restore stock; sort by product_id to acquire locks in consistent order and prevent deadlocks
    for item in sorted(order.items, key=lambda x: x.product_id):
        product = db.query(Product).filter(Product.id == item.product_id).with_for_update().first()
        if product:
            product.quantity += item.quantity
        else:
            logger.warning(
                "Product %s was deleted; could not restore %d units for order %s",
                item.product_id, item.quantity, order.id,
            )

    db.delete(order)
    db.commit()
    cache_delete(f"dashboard:{current_user.id}")
    cache_delete_pattern(f"products:{current_user.id}:*")
