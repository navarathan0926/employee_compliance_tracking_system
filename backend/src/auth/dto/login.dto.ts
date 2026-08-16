import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Login username (not email)' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'your_password', format: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
