import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { User } from '../auth/user.entity';

export async function runSeed(source: DataSource): Promise<void> {
  const usersRepository = source.getRepository(User);

  const adminUsername = process.env.SEED_ADMIN_USERNAME;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const serviceUsername = process.env.SEED_SERVICE_USERNAME;
  const servicePassword = process.env.SEED_SERVICE_PASSWORD;
  const bcryptRounds = Number(process.env.BCRYPT_ROUNDS ?? 12);

  if (
    !adminUsername ||
    !adminPassword ||
    !serviceUsername ||
    !servicePassword
  ) {
    throw new Error(
      'SEED_ADMIN_USERNAME, SEED_ADMIN_PASSWORD, SEED_SERVICE_USERNAME, and SEED_SERVICE_PASSWORD are required',
    );
  }

  async function upsertUser(username: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    const existing = await usersRepository.findOne({ where: { username } });

    if (existing) {
      existing.passwordHash = passwordHash;
      await usersRepository.save(existing);
      return;
    }

    await usersRepository.save(
      usersRepository.create({ username, passwordHash }),
    );
  }

  await upsertUser(adminUsername, adminPassword);
  await upsertUser(serviceUsername, servicePassword);
}
