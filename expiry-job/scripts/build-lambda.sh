#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="${ROOT_DIR}/build/lambda"
OUTPUT_ZIP="${ROOT_DIR}/build/expiry-job-lambda.zip"

rm -rf "${ROOT_DIR}/build"
mkdir -p "${BUILD_DIR}"

python -m pip install \
  -r "${ROOT_DIR}/requirements-lambda.txt" \
  -t "${BUILD_DIR}" \
  --upgrade \
  --no-cache-dir \
  --platform manylinux2014_x86_64 \
  --python-version 3.11 \
  --implementation cp \
  --only-binary=:all:

cp "${ROOT_DIR}"/src/*.py "${BUILD_DIR}/"

find "${BUILD_DIR}" -type d \( -name __pycache__ -o -name tests -o -name test \) -exec rm -rf {} + 2>/dev/null || true

(
  cd "${BUILD_DIR}"
  zip -r "${OUTPUT_ZIP}" .
)

echo "Created ${OUTPUT_ZIP}"
echo "Handler: lambda_handler.handler"
