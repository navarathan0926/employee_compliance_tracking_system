#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build/lambda"
OUTPUT_ZIP="${ROOT_DIR}/build/expiry-job-lambda.zip"

rm -rf "${ROOT_DIR}/build"
mkdir -p "${BUILD_DIR}"

python -m pip install -r "${ROOT_DIR}/requirements.txt" -t "${BUILD_DIR}" --upgrade

cp -r "${ROOT_DIR}/src/." "${BUILD_DIR}/"

(
  cd "${BUILD_DIR}"
  zip -r "${OUTPUT_ZIP}" .
)

echo "Created ${OUTPUT_ZIP}"
