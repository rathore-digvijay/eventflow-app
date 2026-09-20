import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { SERVICES_PORTS } from '@app/common/constants/services.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });
  await app.listen(SERVICES_PORTS.API_GATEWAY);
  console.log(`API Gateway is running on port ${SERVICES_PORTS.API_GATEWAY}`,);
}
bootstrap();
