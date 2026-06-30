"""Mises à jour incrémentales du schéma pour les bases existantes."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection


async def upgrade_schema(conn: AsyncConnection) -> None:
    statements = [
        "ALTER TABLE license_types ADD COLUMN IF NOT EXISTS physical_surcharge NUMERIC(12,2) DEFAULT 50000",
        "ALTER TABLE license_types ADD COLUMN IF NOT EXISTS name_en VARCHAR(255)",
        "ALTER TABLE license_types ADD COLUMN IF NOT EXISTS description_en TEXT",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS delivery_format VARCHAR(20)",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2)",
        "ALTER TABLE applications ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ",
        "ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS ocr_text TEXT",
        "ALTER TABLE application_documents ADD COLUMN IF NOT EXISTS ocr_fields JSONB",
    ]
    for stmt in statements:
        await conn.execute(text(stmt))
