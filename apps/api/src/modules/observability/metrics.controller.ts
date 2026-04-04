import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async metrics(@Res() response: Response) {
    response.setHeader('Cache-Control', 'no-store');
    response.type(this.metricsService.getContentType());
    response.send(await this.metricsService.getMetrics());
  }
}
