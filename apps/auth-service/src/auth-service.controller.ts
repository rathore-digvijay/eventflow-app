import { Body, Controller, Get, Post, Request, UseGuards, } from '@nestjs/common';
import { AuthServiceService } from './auth-service.service';
import { RegisterDto } from '@app/common/dto/register.dto';
import { LoginDto } from '@app/common/dto/login.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller()
export class AuthServiceController {
  constructor(private readonly authServiceService: AuthServiceService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authServiceService.register(dto.email, dto.password, dto.name);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authServiceService.login(dto.email, dto.password);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfile(@Request() req: {user: {userId: string}}) {
    return this.authServiceService.getProfile(req.user.userId);
  }
}
