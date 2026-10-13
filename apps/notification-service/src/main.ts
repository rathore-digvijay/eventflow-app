import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { NotificationServiceModule } from './notification-service.module';
import { KAFKA_BROKER, KAFKA_CLIENT_ID } from '@app/kafka/constants/kafka.constants';
import { SERVICES_PORTS } from '@app/common/constants/services.constants';

async function bootstrap() {
  const app = await NestFactory.create(NotificationServiceModule);

  // connect kafka microservice for consuming events
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options:{
      client: {
        clientId: `${KAFKA_CLIENT_ID}-notifications`,
        brokers: [KAFKA_BROKER],
      },
      consumer: {
        groupId: `notifications-consumer-group`,
      },
    }
  });

  // start all microservices (kafka consumer)
  await app.startAllMicroservices();

  await app.listen(SERVICES_PORTS.NOTIFICATIONS_SERVICE);
  console.log(`Notification service is running on port ${SERVICES_PORTS.NOTIFICATIONS_SERVICE}`);
  console.log('Notification service started (Kafka Consumer).');
}
bootstrap();
