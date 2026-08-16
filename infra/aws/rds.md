# RDS MySQL setup (ap-southeast-1)
#
# 1. Create RDS MySQL instance:
#    - Engine: MySQL 8.x
#    - Template: Free tier
#    - DB instance: db.t3.micro (or db.t4g.micro)
#    - DB name: compliance_tracking
#    - Parameter group: default.mysql8.0 with time_zone=UTC (or use UTC at app layer)
#
# 2. Networking:
#    - VPC: default or dedicated
#    - Public access: No
#    - Security group: inbound 3306 from EB instance security group only
#
# 3. Credentials: store in backend/.env.production → EB environment properties
#
# 4. After RDS is reachable from EB:
#    cd backend
#    npm run migration:run
#    npm run seed
