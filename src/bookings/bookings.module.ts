import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { RulesService } from './rules.service';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [GroupsModule],
  controllers: [BookingsController],
  providers: [BookingsService, RulesService],
  exports: [BookingsService, RulesService],
})
export class BookingsModule {}
