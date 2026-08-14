import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { ExpiringQueryDto } from './dto/expiring-query.dto';
import { MetricsQueryDto } from './dto/metrics-query.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT-auth')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  getMetrics(@Query() query: MetricsQueryDto) {
    return this.dashboardService.getMetrics(query);
  }

  @Get('expiring')
  getExpiring(@Query() query: ExpiringQueryDto) {
    return this.dashboardService.getExpiring(query);
  }
}
