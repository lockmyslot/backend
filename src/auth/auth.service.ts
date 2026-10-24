import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    let username: string | null = null;
    let passwordHash: string | null = null;

    if (dto.username) {
      username = dto.username.trim().toLowerCase();
      const existing = await this.prisma.user.findFirst({
        where: {
          username: { equals: username, mode: 'insensitive' },
        },
      });
      if (existing) {
        throw new ConflictException('Username is already taken');
      }
    }

    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const user = await this.prisma.user.create({
      data: {
        displayName: dto.displayName,
        username,
        passwordHash,
        authToken: randomUUID(),
      },
    });

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      authToken: user.authToken,
      createdAt: user.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const username = dto.username.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid username or password');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      authToken: user.authToken,
      createdAt: user.createdAt,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName,
      },
    });

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

