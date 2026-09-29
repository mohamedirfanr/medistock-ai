"""Hospital Authentication and Facility Access Routes."""

import uuid
from typing import Dict, Any
from fastapi import APIRouter
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: str
    password: str
    facility: str = "St. Jude Memorial Hospital"
    role: str = "Chief Hospital Pharmacist"


class RegisterRequest(BaseModel):
    hospital_name: str
    admin_name: str
    email: str
    bed_capacity: str
    password: str


@router.post("/login")
def login(payload: LoginRequest) -> Dict[str, Any]:
    """Simulates institutional login and issues access token."""
    return {
        "status": "success",
        "access_token": f"medistock_jwt_{uuid.uuid4().hex[:16]}",
        "token_type": "bearer",
        "user": {
            "name": "Dr. Sarah Jenkins",
            "email": payload.email,
            "role": payload.role,
            "facility": payload.facility,
            "permissions": ["READ_INVENTORY", "WRITE_INVENTORY", "DISPATCH_PO"],
        },
    }


@router.post("/register")
def register(payload: RegisterRequest) -> Dict[str, Any]:
    """Registers a new hospital facility."""
    return {
        "status": "success",
        "message": f"Facility '{payload.hospital_name}' registered successfully.",
        "facility_id": f"FAC-{uuid.uuid4().hex[:8].upper()}",
    }
