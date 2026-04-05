import { Module } from '@nestjs/common';
import { AppModule } from './app.module';
import { E2EFailpointModule } from './e2e/e2e-failpoint.module';

@Module({
  imports: [AppModule, E2EFailpointModule]
})
export class E2EAppModule {}
