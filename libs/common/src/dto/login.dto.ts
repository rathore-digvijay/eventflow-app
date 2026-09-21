import { IsNotEmpty, IsString } from "class-validator"
import { IsEmail } from "class-validator"

export class LoginDto {
    @IsEmail({}, { message: 'Invalid email address' })
    @IsNotEmpty({ message: 'Email cannot be empty' })
    email: string

    @IsString({ message: 'Password must be a string' })
    @IsNotEmpty({ message: 'Password cannot be empty' })
    password: string
}