import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from "rxjs";


@Injectable()
export class AuthService {
    private readonly httpServiceUrl = process.env.AUTH_SERVICE_URL;

    constructor(
        private readonly httpService: HttpService,
    ) { }

    async register(data:{email:string, password:string, name:string}){
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.httpServiceUrl}/register`, data)
            );
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async login(data:{email:string, password:string}){
        try {
            const response = await firstValueFrom(
                this.httpService.post(`${this.httpServiceUrl}/login`, data)
            );
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    async getProfile(token: string) {
        try {
            const response = await firstValueFrom(
                this.httpService.get(`${this.httpServiceUrl}/profile`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                })
            );
            return response.data;
        } catch (error) {
            this.handleError(error);
        }
    }

    private handleError(error: any) {
        if (error.response) {
            throw new HttpException(error.response.data, error.response.status);
        }
        throw new HttpException('Something went wrong!', 503);
    }
}
