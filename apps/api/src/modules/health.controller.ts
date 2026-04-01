import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ description: 'API health status' })
  health() {
    return { status: 'ok', service: 'api', timestamp: new Date().toISOString() };
  }
}
