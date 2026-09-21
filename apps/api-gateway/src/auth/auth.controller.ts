import { RegisterDto } from '@app/common/dto/register.dto';
import { LoginDto } from '@app/common/dto/login.dto';
import { Body, Controller, Post, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService
    ) {}

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        // Implement registration logic here
        return this.authService.register(registerDto);
    }

    @Post('login')
    async login(@Body() loginDto: LoginDto) {
        // Implement login logic here
        return this.authService.login(loginDto);
    }

    @Post('profile')
    async getProfile(@Headers('Authorization') authHeader: string) {
        // Implement profile retrieval logic here
        return this.authService.getProfile(authHeader);
    }
}
