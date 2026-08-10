import { Module } from '@nestjs/common';
import { BookingRulesController } from './booking-rules.controller';
import { BookingRulesService } from './booking-rules.service';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [GroupsModule],
  controllers: [BookingRulesController],
  providers: [BookingRulesService],
  exports: [BookingRulesService],
})
export class BookingRulesModule {}
