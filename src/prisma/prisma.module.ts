import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { AuthGuard } from '../common/guards/auth.guard';

@Global()
@Module({
  providers: [PrismaService, AuthGuard],
  exports: [PrismaService, AuthGuard],
})
export class PrismaModule {}
