from decimal import Decimal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator
from typing import Generic, List, TypeVar
from datetime import datetime

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int


# --- Product ---

class ProductCreate(BaseModel):
    name: str = Field(min_length=1)
    sku: str = Field(min_length=1)
    price: Decimal
    quantity: int

    @field_validator("price")
    @classmethod
    def price_must_be_positive(cls, v):
        if v < 0:
            raise ValueError("Price cannot be negative")
        return v

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError("Quantity cannot be negative")
        return v



class ProductOut(BaseModel):
    id: int
    name: str
    sku: str
    price: Decimal
    quantity: int
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Customer ---

class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=1)
    email: EmailStr
    phone: str = Field(min_length=1)


class CustomerOut(BaseModel):
    id: int
    full_name: str
    email: str
    phone: str
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Order ---

class OrderItemCreate(BaseModel):
    product_id: int = Field(ge=1)
    quantity: int

    @field_validator("quantity")
    @classmethod
    def quantity_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v


class OrderCreate(BaseModel):
    customer_id: int = Field(ge=1)
    items: List[OrderItemCreate]

    @field_validator("items")
    @classmethod
    def items_must_not_be_empty(cls, v):
        if not v:
            raise ValueError("Order must contain at least one item")
        return v


class ProductSummary(BaseModel):
    id: int
    name: str

    model_config = {"from_attributes": True}


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: Decimal
    product: ProductSummary

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    customer_id: int
    total_amount: Decimal
    created_at: datetime
    customer: CustomerOut
    items: List[OrderItemOut]

    model_config = {"from_attributes": True}


# --- Auth ---

class UserCreate(BaseModel):
    username: str = Field(min_length=1)
    password: str

    @field_validator("username")
    @classmethod
    def username_no_spaces(cls, v):
        if not v.strip() or any(c.isspace() for c in v):
            raise ValueError("Username cannot be empty or contain whitespace")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or fewer")
        return v


class TokenOut(BaseModel):
    access_token: str
    token_type: str


# --- Dashboard ---

class DashboardOut(BaseModel):
    total_products: int
    total_customers: int
    total_orders: int
    low_stock_products: List[ProductOut]
    low_stock_threshold: int
