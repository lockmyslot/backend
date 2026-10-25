import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { GroupsModule } from './groups/groups.module';
import { ResourcesModule } from './resources/resources.module';
import { BookingRulesModule } from './booking-rules/booking-rules.module';
import { BookingsModule } from './bookings/bookings.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { InvitesModule } from './invites/invites.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SnakeCaseMiddleware } from './common/middleware/snake-case.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    GroupsModule,
    ResourcesModule,
    BookingRulesModule,
    BookingsModule,
    MaintenanceModule,
    InvitesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SnakeCaseMiddleware).forRoutes('*');
  }
}
