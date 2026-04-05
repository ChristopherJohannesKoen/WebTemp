import { Body, Controller, Delete, Post } from '@nestjs/common';
import { SetFailpointDto } from './dto/set-failpoint.dto';
import { E2EFailpointService } from './e2e-failpoint.service';

@Controller('__e2e/failpoints')
export class E2EFailpointController {
  constructor(private readonly failpointService: E2EFailpointService) {}

  @Post()
  setFailpoint(@Body() dto: SetFailpointDto) {
    this.failpointService.setFailpoint(dto);

    return { ok: true };
  }

  @Delete()
  clearFailpoints() {
    this.failpointService.clearAll();

    return { ok: true };
  }
}
