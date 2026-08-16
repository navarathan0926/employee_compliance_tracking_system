from __future__ import annotations

import logging
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parent
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from api_client import ApiClient, ApiClientError
from config import Config, load_config
from evaluator import EvaluationResult, StatusUpdate, evaluate_records
from event_publisher import build_event_payload, publish_event, republish_pending_event
from status import get_today_in_timezone

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RunResult:
    run_id: str
    evaluation_date: str
    fetched_count: int
    update_count: int
    changed_count: int
    failed_batch_count: int


def run_expiry_job(config: Config | None = None) -> RunResult:
    settings = config or load_config()
    republish_pending_event(settings)

    run_id = str(uuid.uuid4())
    evaluation_date = get_today_in_timezone(settings.compliance_timezone)
    evaluation_date_str = evaluation_date.isoformat()

    client = ApiClient(settings)
    client.login()

    snapshot = client.fetch_all_active_expiring()
    logger.info("Fetched %s active/expiring records", len(snapshot))

    evaluation = evaluate_records(
        snapshot,
        today=evaluation_date,
        buffer_days=settings.compliance_expiring_buffer_days,
    )

    successful_updates, failed_batch_count = apply_status_updates(client, evaluation)

    payload = build_event_payload(
        settings,
        run_id=run_id,
        evaluation_date=evaluation_date_str,
        successful_updates=successful_updates,
    )
    publish_event(settings, payload)

    return RunResult(
        run_id=run_id,
        evaluation_date=evaluation_date_str,
        fetched_count=len(snapshot),
        update_count=len(evaluation.updates),
        changed_count=len(successful_updates),
        failed_batch_count=failed_batch_count,
    )


def apply_status_updates(
    client: ApiClient,
    evaluation: EvaluationResult,
) -> tuple[list[StatusUpdate], int]:
    if not evaluation.batches:
        logger.info("No status updates required")
        return [], 0

    successful_ids: set[int] = set()
    failed_batch_count = 0

    for index, batch in enumerate(evaluation.batches, start=1):
        batch_ids = {int(item["id"]) for item in batch}
        try:
            client.bulk_status_update(batch)
            successful_ids.update(batch_ids)
            logger.info("Applied bulk-status batch %s (%s records)", index, len(batch))
        except ApiClientError as error:
            failed_batch_count += 1
            logger.error("Bulk-status batch %s failed: %s", index, error)

    successful_updates = [
        update for update in evaluation.updates if update.id in successful_ids
    ]
    return successful_updates, failed_batch_count


def configure_logging() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )


def main() -> int:
    configure_logging()

    try:
        result = run_expiry_job()
    except (ApiClientError, ValueError, RuntimeError) as error:
        logger.error("Expiry job failed: %s", error)
        return 1

    logger.info(
        "Expiry job completed runId=%s evaluationDate=%s fetched=%s plannedUpdates=%s changed=%s failedBatches=%s",
        result.run_id,
        result.evaluation_date,
        result.fetched_count,
        result.update_count,
        result.changed_count,
        result.failed_batch_count,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
