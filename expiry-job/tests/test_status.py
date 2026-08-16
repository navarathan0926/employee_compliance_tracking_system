from datetime import date, datetime

try:
    from zoneinfo import ZoneInfo
except ImportError:
    from backports.zoneinfo import ZoneInfo

from status import compute_compliance_status, get_today_in_timezone


def test_returns_expired_when_expiry_date_is_before_today() -> None:
    today = date(2026, 8, 14)
    assert compute_compliance_status("2026-08-13", today, 30) == "expired"


def test_returns_expiring_when_expiry_date_is_within_buffer_window() -> None:
    today = date(2026, 8, 14)
    assert compute_compliance_status("2026-08-14", today, 30) == "expiring"
    assert compute_compliance_status("2026-09-13", today, 30) == "expiring"


def test_returns_active_when_expiry_date_is_beyond_buffer_window() -> None:
    today = date(2026, 8, 14)
    assert compute_compliance_status("2026-09-14", today, 30) == "active"


def test_handles_string_buffer_days() -> None:
    today = date(2026, 8, 14)
    assert compute_compliance_status("2027-08-01", today, "30") == "active"


def test_supports_active_to_expired_transition() -> None:
    today = date(2026, 8, 14)
    assert compute_compliance_status("2026-01-01", today, 30) == "expired"


def test_today_uses_asia_colombo_calendar_date() -> None:
    just_before_midnight = datetime(2026, 8, 13, 18, 29, tzinfo=ZoneInfo("UTC"))
    at_colombo_midnight = datetime(2026, 8, 13, 18, 30, tzinfo=ZoneInfo("UTC"))

    assert get_today_in_timezone("Asia/Colombo", just_before_midnight) == date(2026, 8, 13)
    assert get_today_in_timezone("Asia/Colombo", at_colombo_midnight) == date(2026, 8, 14)
