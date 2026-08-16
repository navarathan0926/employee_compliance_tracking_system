from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from config import PATCH_BATCH_SIZE
from status import compute_compliance_status


@dataclass(frozen=True)
class StatusUpdate:
    id: int
    new_status: str
    previous_status: str


@dataclass(frozen=True)
class EvaluationResult:
    updates: list[StatusUpdate]
    batches: list[list[dict[str, int | str]]]


def deduplicate_records(records: list[dict]) -> list[dict]:
    by_id: dict[int, dict] = {}
    for record in records:
        by_id[int(record["id"])] = record
    return list(by_id.values())


def evaluate_records(
    records: list[dict],
    today: date,
    buffer_days: int,
    batch_size: int = PATCH_BATCH_SIZE,
) -> EvaluationResult:
    unique_records = deduplicate_records(records)
    updates: list[StatusUpdate] = []

    for record in unique_records:
        computed_status = compute_compliance_status(
            record["expiryDate"],
            today,
            buffer_days,
        )
        current_status = record["status"]

        if computed_status == current_status:
            continue

        updates.append(
            StatusUpdate(
                id=int(record["id"]),
                new_status=computed_status,
                previous_status=current_status,
            )
        )

    payload_items = [
        {"id": update.id, "newStatus": update.new_status} for update in updates
    ]
    batches = [
        payload_items[index : index + batch_size]
        for index in range(0, len(payload_items), batch_size)
    ]

    return EvaluationResult(updates=updates, batches=batches)
