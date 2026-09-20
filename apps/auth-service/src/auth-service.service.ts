import { KAFKA_SERVICE, KAFKA_TOPICS } from '@app/kafka';
import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';

@Injectable()
export class AuthServiceService implements OnModuleInit {
  constructor(
    @Inject(KAFKA_SERVICE) private readonly kafkaClient: ClientKafka
  ){}

  async onModuleInit() {
    // connect to kafka when module is initialized
    await this.kafkaClient.connect();
  }

  getHello(): string {
    return 'Hello World!';
  }

  simulateUserRegistration(email:string) {
    // publish to kafka topic
    this.kafkaClient.emit(KAFKA_TOPICS.USER_REGISTERED, { 
      email,
      timestamp: new Date().toISOString() 
    });
    return { message: `User registration event published for email: ${email}` };
  }
}
