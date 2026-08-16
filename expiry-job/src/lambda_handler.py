from __future__ import annotations

import logging

from main import configure_logging, run_expiry_job

logger = logging.getLogger(__name__)


def handler(event: dict, context: object) -> dict:
    """AWS Lambda entrypoint for the scheduled expiry job."""
    del event, context
    configure_logging()

    try:
        result = run_expiry_job()
    except Exception as error:
        logger.error("Expiry job failed: %s", error)
        raise

    return {
        "statusCode": 200,
        "body": {
            "runId": result.run_id,
            "evaluationDate": result.evaluation_date,
            "fetchedCount": result.fetched_count,
            "updateCount": result.update_count,
            "changedCount": result.changed_count,
            "failedBatchCount": result.failed_batch_count,
        },
    }
