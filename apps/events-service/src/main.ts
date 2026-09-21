import { NestFactory } from '@nestjs/core';
import { EventsServiceModule } from './events-service.module';
import { SERVICES_PORTS } from '@app/common/constants/services.constants';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(EventsServiceModule);

    // Enable validation globally
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }
    ));
  
  await app.listen(SERVICES_PORTS.EVENTS_SERVICE);
  console.log(`Events Service is running on port: ${SERVICES_PORTS.EVENTS_SERVICE}`);
}
bootstrap();
