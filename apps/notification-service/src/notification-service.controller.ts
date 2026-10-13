import { Controller, Get } from '@nestjs/common';
import { NotificationServiceService } from './notification-service.service';
import { Logger } from '@nestjs/common';
import { KAFKA_TOPICS } from '@app/kafka/constants/kafka.constants';
import { EventPattern, Payload } from '@nestjs/microservices';

@Controller()
export class NotificationServiceController {
  private readonly logger = new Logger(NotificationServiceController.name);

  constructor(
    private readonly notificationServiceService: NotificationServiceService
  ) { }

  @Get('health')
  healthCheck() {
    this.logger.log('Health check endpoint called');
    return { status: 'ok', message: 'Notification Service is healthy' };
  }

  @EventPattern(KAFKA_TOPICS.USER_REGISTERED)
  async handleUserRegistered(
    @Payload() data: { userId: string; email: string; name: string },
  ) {
    this.logger.log(`Received user registered event: ${JSON.stringify(data)}`);
    await this.notificationServiceService.sendWelcomeEmail(data);
  }

  @EventPattern(KAFKA_TOPICS.TICKET_PURCHASED)
  async handleTicketPurchased(
    @Payload()
    data: {
      ticketId: string;
      ticketCode: string;
      userId: string;
      quantity: number;
      totalPrice: number;
    },
  ) {
    this.logger.log(`Received ticket purchase event: ${JSON.stringify(data)}`);
    await this.notificationServiceService.sendTicketPurchasedEmail(data);
  }

  @EventPattern(KAFKA_TOPICS.TICKET_CANCELLED)
  async handleTicketCancelled(
    @Payload() data: { ticketId: string; userId: string },
  ) {
    this.logger.log(
      `Received ticket cancellation event: ${JSON.stringify(data)}`,
    );
    await this.notificationServiceService.sendTicketCancelledEmail(data);
  }

}
