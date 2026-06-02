import math
import os

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..auth import get_current_user, CurrentUser
from ..cache import cache_delete, cache_delete_pattern, cache_get, cache_set
from ..database import get_db
from ..models import Product
from ..schemas import ProductCreate, ProductUpdate, ProductOut, PaginatedResponse

router = APIRouter(prefix="/products", tags=["Products"])

CACHE_TTL = int(os.getenv("PRODUCTS_CACHE_TTL", "30"))


def _bust_product_caches(user_id: int):
    cache_delete_pattern(f"products:{user_id}:*")
    cache_delete(f"dashboard:{user_id}")


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    product = Product(**payload.model_dump(), user_id=current_user.id)
    db.add(product)
    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU already exists")
    _bust_product_caches(current_user.id)
    return product


@router.get("", response_model=PaginatedResponse[ProductOut])
def get_products(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    cache_key = f"products:{current_user.id}:page={page}:size={size}"
    cached = cache_get(cache_key)
    if cached:
        return cached

    total = db.query(Product).filter(Product.user_id == current_user.id).count()
    items = db.query(Product).filter(Product.user_id == current_user.id).order_by(Product.id).offset((page - 1) * size).limit(size).all()
    result = {"items": items, "total": total, "page": page, "size": size, "pages": math.ceil(total / size) if total else 1}
    cache_set(cache_key, jsonable_encoder(result), ttl=CACHE_TTL)
    return result


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: int,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    try:
        db.commit()
        db.refresh(product)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="SKU already exists")
    _bust_product_caches(current_user.id)
    return product


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    product = db.query(Product).filter(Product.id == product_id, Product.user_id == current_user.id).with_for_update().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    try:
        db.delete(product)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Cannot delete product with existing orders")
    _bust_product_caches(current_user.id)
