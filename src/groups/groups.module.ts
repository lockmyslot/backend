import { Module } from '@nestjs/common';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { GroupMemberGuard } from './guards/group-member.guard';

@Module({
  controllers: [GroupsController],
  providers: [GroupsService, GroupMemberGuard],
  exports: [GroupsService, GroupMemberGuard],
})
export class GroupsModule {}
