import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ComplianceConfigService {
  constructor(private readonly configService: ConfigService) {}

  get bufferDays(): number {
    const value = this.configService.get<string>(
      'COMPLIANCE_EXPIRING_BUFFER_DAYS',
      '30',
    );
    return Number(value);
  }

  get timezone(): string {
    return this.configService.get<string>('COMPLIANCE_TIMEZONE', 'Asia/Colombo');
  }

  get bcryptRounds(): number {
    const value = this.configService.get<string>('BCRYPT_ROUNDS', '12');
    return Number(value);
  }
}
