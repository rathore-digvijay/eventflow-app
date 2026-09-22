import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateEventDto, UpdateEventDto } from '@app/common';

@Controller('events')
export class EventsController {

    constructor(
        private readonly eventService: EventsService
    ) { }

    @Get()
    findAll() {
        return this.eventService.findAll()
    }

    @UseGuards(AuthGuard('jwt'))
    @Get('my-events')
    findMyEvents(@Request() req: { user: { userId: string } }) {
        return this.eventService.findMyEvents(req.user.userId);
    }

    @Get(':id')
    findOne(@Param('id', ParseUUIDPipe) id:string) {
        return this.eventService.findOne(id);
    }

    @UseGuards(AuthGuard('jwt'))
    @Post()
    create(
        @Body() createEventDto: CreateEventDto,
        @Request() req: { user: { userId: string; role?: string } },
    ) {
        return this.eventService.create(
            createEventDto,
            req.user.userId,
            req.user.role || 'USER',
        );
    }

    @UseGuards(AuthGuard('jwt'))
    @Put(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() updateEventDto: UpdateEventDto,
        @Request() req: { user: { userId: string; role?: string } },
    ) {
        return this.eventService.update(
            id,
            updateEventDto,
            req.user.userId,
            req.user.role || 'USER',
        );
    }

    // Protected - publish event
    @UseGuards(AuthGuard('jwt'))
    @Post(':id/publish')
    publish(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: { user: { userId: string; role?: string } },
    ) {
        return this.eventService.publish(
            id,
            req.user.userId,
            req.user.role || 'USER',
        );
    }

    // Protected - cancel event
    @UseGuards(AuthGuard('jwt'))
    @Post(':id/cancel')
    cancel(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: { user: { userId: string; role?: string } },
    ) {
        return this.eventService.cancel(
            id,
            req.user.userId,
            req.user.role || 'USER',
        );
    }
}