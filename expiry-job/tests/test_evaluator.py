from datetime import date

from evaluator import deduplicate_records, evaluate_records


def test_skips_when_computed_status_matches_current_status() -> None:
    today = date(2026, 8, 14)
    records = [
        {"id": 1, "status": "active", "expiryDate": "2027-01-01"},
        {"id": 2, "status": "expiring", "expiryDate": "2026-08-20"},
    ]

    result = evaluate_records(records, today=today, buffer_days=30)

    assert result.updates == []
    assert result.batches == []


def test_includes_records_when_computed_status_differs() -> None:
    today = date(2026, 8, 14)
    records = [
        {"id": 1, "status": "active", "expiryDate": "2026-08-20"},
        {"id": 2, "status": "expiring", "expiryDate": "2026-08-13"},
    ]

    result = evaluate_records(records, today=today, buffer_days=30)

    assert len(result.updates) == 2
    assert result.updates[0].id == 1
    assert result.updates[0].new_status == "expiring"
    assert result.updates[1].id == 2
    assert result.updates[1].new_status == "expired"
    assert len(result.batches) == 1
    assert result.batches[0] == [
        {"id": 1, "newStatus": "expiring"},
        {"id": 2, "newStatus": "expired"},
    ]


def test_splits_updates_into_batches_of_200() -> None:
    today = date(2026, 8, 14)
    records = [
        {
            "id": index,
            "status": "active",
            "expiryDate": "2026-08-20",
        }
        for index in range(1, 402)
    ]

    result = evaluate_records(records, today=today, buffer_days=30, batch_size=200)

    assert len(result.updates) == 401
    assert len(result.batches) == 3
    assert len(result.batches[0]) == 200
    assert len(result.batches[1]) == 200
    assert len(result.batches[2]) == 1


def test_includes_expiring_to_active_downgrade() -> None:
    today = date(2026, 8, 14)
    records = [
        {"id": 1, "status": "expiring", "expiryDate": "2027-01-01"},
    ]

    result = evaluate_records(records, today=today, buffer_days=30)

    assert len(result.updates) == 1
    assert result.updates[0].id == 1
    assert result.updates[0].previous_status == "expiring"
    assert result.updates[0].new_status == "active"
    assert result.batches == [[{"id": 1, "newStatus": "active"}]]


def test_deduplicates_records_by_id() -> None:
    records = [
        {"id": 1, "status": "active", "expiryDate": "2027-01-01"},
        {"id": 1, "status": "active", "expiryDate": "2027-01-01"},
    ]

    deduplicated = deduplicate_records(records)

    assert len(deduplicated) == 1
