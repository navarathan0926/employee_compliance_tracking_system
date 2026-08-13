# Architecture Decisions

This document records the key architecture decisions for the Employee Compliance Tracking System, along with the reasoning behind each.

## 1. Record ID Strategy: Incremental Integer

**Decision:** Auto-incrementing integer primary keys for `ComplianceRecord`, `Employee`, and `User`.

**Reasoning:** The NestJS API is the single writer (multiple replicas share one database, still one logical writer), so UUID's original justification (avoiding ID collisions across independent writers) doesn't apply. The leak-resistance concern (guessable IDs) is mitigated by proper per-request authorization checks, which are required regardless of ID scheme. Given that, incremental IDs are the simpler, faster choice (smaller index size, faster joins) with no real downside at this scale. UUIDs would only become worthwhile if a second service gained direct write access to the database, or the system became distributed/sharded.

## 2. Database: MySQL on AWS RDS Free Tier

**Decision:** MySQL, hosted on AWS RDS Free Tier.

**Reasoning:** RDS Free Tier supports MySQL directly. EventBridge and SQS are independent of the database engine, so there's no compatibility concern with the messaging services used elsewhere.

## 3. ORM: TypeORM

**Decision:** TypeORM for the NestJS backend.

**Reasoning:** First-class NestJS support, decorator-based entities matching Nest's style, integrates cleanly with MySQL.

## 4. Python Job: Deployment Strategy

**Decision:** The Python expiry job calls the NestJS API over HTTP rather than connecting to MySQL directly. It runs locally as a script during development, and is deployed later as an AWS Lambda triggered by EventBridge Scheduler.

**Reasoning:**
- Keeps the NestJS API as the single writer to the database, avoiding validation logic drifting out of sync across two codebases.
- Avoids Lambda-to-RDS VPC networking complexity.
- The job's core logic is deployment-agnostic, the same code runs as a local script or a Lambda invocation.

## 5. Employee Data Model

**Decision:** `Employee` is a separate entity from `ComplianceRecord`, sharing a NestJS module with separate services and files per entity.

**Reasoning:** Employees have their own identity and attributes independent of any single compliance record; one employee has many records. Sharing a module keeps the codebase simple at the current scope while separate services keep the two domains' logic distinct.

## 6. Authentication

**Decision:** Simple username/password login issuing a JWT. No broader user-management system.

**Reasoning:** The API needs to not be fully open, but there's no requirement for roles, registration flows, or multi-tenant users. A minimal login-to-JWT flow is sufficient.

## 7. Messaging: AWS EventBridge + SQS

**Decision:** After each scheduled run, the expiry job publishes a summary event (not one event per record) to EventBridge, which routes it to SQS.

**Reasoning:** Decouples "detecting expiries" from "reacting to them." The job's only responsibility is detection and status update; anything that needs to react (notifications, audit logging) can consume from the queue independently, without the job needing to know who's listening.

**Testing approach:** Tested locally first (e.g. via LocalStack) before wiring up the real AWS SQS queue and EventBridge rule.

## 8. Status Lifecycle: No Auto-Archive on Expiry

**Decision:** The expiry job only ever changes a record's `status` field (active to expiring to expired). It never archives or soft-deletes records. Archiving/soft-delete is a separate, manual action available only through the CRUD API (e.g. when an employee leaves, or a record was entered in error).

**Reasoning:** "Expired" and "archived" are different concerns, expired means the compliance item has lapsed and needs attention, archived means the record itself is no longer relevant to track. Conflating the two would hide expired-but-still-relevant records from normal views.

## 9. Soft Delete vs Hard Delete

**Decision:** Soft delete (`deletedAt` timestamp / `status: archived`) as the default for manual archiving. Hard delete reserved only for correcting genuine data-entry errors.

**Reasoning:** Compliance records may need to be referenced later for audits or legal purposes even after they're no longer active.

## 10. Dashboard Reporting Strategy: Live-Computed

**Decision:** Dashboard metrics are computed live on each request rather than pre-aggregated into a separate table.

**Reasoning:** At the current data volume, live queries are simple and always consistent. A pre-aggregated table would reduce query-time cost but adds staleness risk and sync complexity not justified at this scale.

## 11. Bulk Processing, Batching, Retries, Idempotency

**Decision:**
- The expiry job updates records in bulk (one query to fetch, one bulk update call), not one at a time.
- Large runs are split into batches (e.g. 500 records per batch) rather than a single unbounded request.
- Each external call (API request, SQS publish) is wrapped with retry and backoff, and has a request timeout, so one slow or failed call doesn't block the whole run. Failed batches are logged and skipped rather than aborting the entire job.
- Idempotency is enforced via a `lastEvaluatedStatus` field on each record, if a record's status already matches what the job is about to set, it's skipped, no duplicate event is published.

**Reasoning:** Bulk and batched processing reduces database/API round trips and keeps individual requests a manageable size. Retries with backoff handle transient network/timeout issues without needing a separate background worker. Idempotency prevents duplicate alerts if the job is rerun or retried within the same evaluation window.

## 12. Deployment Targets

**Decision:** NestJS API and SvelteKit frontend deployed on AWS Elastic Beanstalk. Python job deployed as an AWS Lambda, triggered by EventBridge Scheduler on a time-based rule (not a request-driven trigger).

**Reasoning:** Elastic Beanstalk handles deployment, scaling, and server management for the always-on API/frontend, avoiding manual EC2 management. Lambda is the natural serverless fit for a short scheduled task, no server to maintain, fits Free Tier well, and pairs directly with EventBridge Scheduler.

## 13. File Attachments (S3)

**Decision:** Not implemented for now. A `notes` text field satisfies the "supporting documentation or notes" need. S3 file upload is deferred, to be revisited later if time allows.
