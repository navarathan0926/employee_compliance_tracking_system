import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index({ unique: true })
  @Column({ length: 255 })
  username!: string;

  @Column({ name: 'passwordHash', length: 255 })
  passwordHash!: string;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt!: Date;
}
