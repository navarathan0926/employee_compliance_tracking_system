# Elastic Beanstalk single-instance deployment
#
# Console steps (ap-southeast-1):
#
# 1. Create application: compliance-tracking-api
# 2. Create environment:
#    - Environment tier: Web server
#    - Platform: Node.js 20 (or match project)
#    - Environment type: Single instance (NOT Load balanced)
#    - Instance type: t3.micro (Free Tier)
#
# 3. Deploy backend/ directory (zip or EB CLI):
#    cd backend
#    npm ci && npm run build
#    eb init / eb deploy  (or upload zip via console)
#
# 4. Set environment properties from backend/.env.production
#    (DATABASE_*, JWT_SECRET, CORS_ALLOWED_ORIGINS, THROTTLE_*, etc.)
#
# 5. Security groups:
#    - EB instance SG: allow inbound 80 from CloudFront (or 0.0.0.0/0 for demo)
#    - RDS SG: allow 3306 from EB instance SG only
#
# 6. Run migrations + seed (once):
#    npm run migration:run && npm run seed
#    (from machine with RDS access or GitHub Actions migrate workflow)
#
# Files in this repo:
#   - backend/Procfile
#   - backend/scripts/build-eb-zip.ps1 (builds dist locally; zips with tar for Linux paths)
#
# Deploy bundle: Procfile + package.json + dist (no node_modules).
# EB installs Linux-native dependencies on the instance (required for bcrypt).
# Do NOT use legacy .ebextensions NodeCommand — invalid on Node.js 22 / AL2023.
