import { NestFactory } from '@nestjs/core';
import { AuthServiceModule } from './auth-service.module';
import { SERVICES_PORTS } from '@app/common/constants/services.constants';

async function bootstrap() {
  const app = await NestFactory.create(AuthServiceModule);
  await app.listen(SERVICES_PORTS.AUTH_SERVICE);
  console.log(`Auth Service is running on port ${SERVICES_PORTS.AUTH_SERVICE}`);
}
bootstrap();
