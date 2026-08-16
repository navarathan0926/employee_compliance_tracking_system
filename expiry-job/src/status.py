from __future__ import annotations

from datetime import date, datetime, timedelta

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

EvaluableStatus = str


def get_today_in_timezone(timezone: str, reference: datetime | None = None) -> date:
    current = reference or datetime.now(ZoneInfo(timezone))
    localized = current.astimezone(ZoneInfo(timezone))
    return localized.date()


def add_days_to_date(value: date, days: int) -> date:
    return value + timedelta(days=int(days))


def parse_date(value: str) -> date:
    return date.fromisoformat(value)


def compute_compliance_status(
    expiry_date: str,
    today: date,
    buffer_days: int,
) -> EvaluableStatus:
    expiry = parse_date(expiry_date)

    if expiry < today:
        return "expired"

    expiring_threshold = add_days_to_date(today, buffer_days)
    if expiry <= expiring_threshold:
        return "expiring"

    return "active"
