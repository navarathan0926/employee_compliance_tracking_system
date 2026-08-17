import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { ComplianceConfigService } from '../common/compliance-config.service';
import { User } from './user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly complianceConfig: ComplianceConfigService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user) {
      return null;
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    return user;
  }

  async createToken(user: User): Promise<{ accessToken: string }> {
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      username: user.username,
    });

    return { accessToken };
  }

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.complianceConfig.bcryptRounds);
  }

  async upsertUser(username: string, password: string): Promise<void> {
    const passwordHash = await this.hashPassword(password);
    const existing = await this.usersRepository.findOne({
      where: { username },
    });

    if (existing) {
      existing.passwordHash = passwordHash;
      await this.usersRepository.save(existing);
      return;
    }

    await this.usersRepository.save(
      this.usersRepository.create({ username, passwordHash }),
    );
  }
}
