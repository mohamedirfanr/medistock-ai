"""MediStock AI Backend Configuration Settings."""

import os
from typing import List


class Settings:
    PROJECT_NAME: str = "MediStock AI"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = (
        "AI-Powered Hospital Medicine Inventory Management & Demand Forecasting API"
    )
    API_PREFIX: str = "/api"

    # CORS configuration to allow local frontend access
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "*",  # Allow all for seamless local dev & testing
    ]

    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Required CSV headers
    REQUIRED_CSV_COLUMNS: List[str] = [
        "Medicine",
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Current_Stock",
    ]


settings = Settings()
