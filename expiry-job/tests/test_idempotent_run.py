from datetime import date
from unittest.mock import Mock

from evaluator import EvaluationResult, StatusUpdate
from main import apply_status_updates, run_expiry_job


def test_second_run_skips_patch_after_first_run_applies_updates(sample_config, mocker) -> None:
    today = date(2026, 8, 14)
    first_snapshot = [
        {"id": 1, "status": "active", "expiryDate": "2026-08-20"},
    ]
    second_snapshot = [
        {"id": 1, "status": "expiring", "expiryDate": "2026-08-20"},
    ]

    client = Mock()
    client.login.return_value = None
    client.fetch_all_active_expiring.side_effect = [first_snapshot, second_snapshot]
    bulk_update = Mock(return_value={"processed": 1})
    client.bulk_status_update = bulk_update

    mocker.patch("main.load_config", return_value=sample_config)
    mocker.patch("main.ApiClient", return_value=client)
    mocker.patch("main.get_today_in_timezone", return_value=today)
    publish = mocker.patch("main.publish_event")

    first_result = run_expiry_job(sample_config)
    second_result = run_expiry_job(sample_config)

    assert first_result.update_count == 1
    assert first_result.changed_count == 1
    assert second_result.update_count == 0
    assert second_result.changed_count == 0
    bulk_update.assert_called_once_with([{"id": 1, "newStatus": "expiring"}])
    assert publish.call_count == 2


def test_empty_snapshot_skips_patch_and_still_publishes(sample_config, mocker) -> None:
    today = date(2026, 8, 14)
    client = Mock()
    client.login.return_value = None
    client.fetch_all_active_expiring.return_value = []

    mocker.patch("main.load_config", return_value=sample_config)
    mocker.patch("main.ApiClient", return_value=client)
    mocker.patch("main.get_today_in_timezone", return_value=today)
    publish = mocker.patch("main.publish_event")

    result = run_expiry_job(sample_config)

    assert result.fetched_count == 0
    assert result.update_count == 0
    assert result.changed_count == 0
    client.bulk_status_update.assert_not_called()
    publish.assert_called_once()


def test_apply_status_updates_skips_patch_phase_when_no_batches() -> None:
    client = Mock()
    evaluation = EvaluationResult(updates=[], batches=[])

    successful, failed = apply_status_updates(client, evaluation)

    assert successful == []
    assert failed == 0
    client.bulk_status_update.assert_not_called()


def test_apply_status_updates_tracks_failed_batches() -> None:
    client = Mock()

    evaluation = EvaluationResult(
        updates=[
            StatusUpdate(id=1, new_status="expiring", previous_status="active"),
            StatusUpdate(id=2, new_status="expired", previous_status="expiring"),
        ],
        batches=[
            [{"id": 1, "newStatus": "expiring"}],
            [{"id": 2, "newStatus": "expired"}],
        ],
    )

    from api_client import ApiClientError

    client.bulk_status_update.side_effect = [
        {"processed": 1},
        ApiClientError("batch failed"),
    ]

    successful, failed = apply_status_updates(client, evaluation)

    assert len(successful) == 1
    assert successful[0].id == 1
    assert failed == 1
