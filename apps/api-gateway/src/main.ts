import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module';
import { SERVICES_PORTS } from '@app/common/constants/services.constants';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }
  ));

  await app.listen(SERVICES_PORTS.API_GATEWAY);
  console.log(`API Gateway is running on port ${SERVICES_PORTS.API_GATEWAY}`,);
}
bootstrap();
