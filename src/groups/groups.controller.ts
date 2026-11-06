import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { PinGroupDto } from './dto/pin-group.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { AuthGuard } from '../common/guards/auth.guard';
import { GroupMemberGuard } from './guards/group-member.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { GroupRole } from '@prisma/client';

@ApiTags('Groups')
@Controller('groups')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new group (creator becomes ADMIN)' })
  @ApiResponse({ status: 201, description: 'Group created' })
  async createGroup(@CurrentUser() user: any, @Body() dto: CreateGroupDto) {
    return this.groupsService.createGroup(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all groups current user belongs to' })
  @ApiResponse({ status: 200, description: 'List of groups' })
  async getUserGroups(@CurrentUser() user: any) {
    return this.groupsService.getUserGroups(user.id);
  }

  @Post('join')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Join a group using invite code' })
  @ApiResponse({ status: 201, description: 'Joined group successfully' })
  @ApiResponse({ status: 404, description: 'invalid_invite_code' })
  @ApiResponse({ status: 409, description: 'already_a_member' })
  async joinGroup(@CurrentUser() user: any, @Body() dto: JoinGroupDto) {
    return this.groupsService.joinGroup(user.id, dto);
  }

  @Get(':id')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Get group details' })
  @ApiResponse({ status: 200, description: 'Group details' })
  @ApiResponse({ status: 403, description: 'Not a group member' })
  async getGroupDetails(@Param('id') id: string, @CurrentUser() user: any) {
    return this.groupsService.getGroupDetails(id, user.id);
  }

  @Patch(':id')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @ApiOperation({ summary: 'Update group name (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Group updated' })
  @ApiResponse({ status: 403, description: 'Forbidden / Not ADMIN' })
  async updateGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groupsService.updateGroup(id, dto, user.id);
  }

  @Patch(':id/pin')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'Pin or unpin a group to the top for current user' })
  @ApiResponse({ status: 200, description: 'Group pin status toggled' })
  async togglePinGroup(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto?: PinGroupDto,
  ) {
    return this.groupsService.togglePinGroup(id, user.id, dto?.isPinned);
  }

  @Get(':id/members')
  @UseGuards(GroupMemberGuard)
  @ApiOperation({ summary: 'List group members' })
  @ApiResponse({ status: 200, description: 'List of members' })
  async getMembers(@Param('id') id: string) {
    return this.groupsService.getMembers(id);
  }

  @Post(':id/invite')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Invite a user to the group by username (ADMIN only)',
  })
  @ApiResponse({ status: 201, description: 'User added to group successfully' })
  @ApiResponse({ status: 400, description: 'cannot_invite_self' })
  @ApiResponse({ status: 404, description: 'user_not_found' })
  @ApiResponse({ status: 409, description: 'already_a_member' })
  async inviteMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: InviteMemberDto,
  ) {
    return this.groupsService.inviteMemberByUsername(id, user.id, dto);
  }

  @Post(':id/members')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a user to the group by username (ADMIN only)' })
  @ApiResponse({ status: 201, description: 'User added to group successfully' })
  @ApiResponse({ status: 400, description: 'cannot_invite_self' })
  @ApiResponse({ status: 404, description: 'user_not_found' })
  @ApiResponse({ status: 409, description: 'already_a_member' })
  async addMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: InviteMemberDto,
  ) {
    return this.groupsService.inviteMemberByUsername(id, user.id, dto);
  }

  @Patch(':id/members/:user_id/role')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @ApiOperation({ summary: 'Update a member role (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid role or missing expires_at for guest',
  })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async updateMemberRole(
    @Param('id') id: string,
    @Param('user_id') targetUserId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.groupsService.updateMemberRole(id, user.id, targetUserId, dto);
  }

  @Delete(':id/members/:user_id')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN, GroupRole.MODERATOR)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a member from group (ADMIN or MODERATOR for guests)',
  })
  @ApiResponse({ status: 204, description: 'Member removed' })
  @ApiResponse({ status: 400, description: 'cannot_remove_self' })
  @ApiResponse({
    status: 403,
    description: 'cannot_remove_admin or moderator cannot remove non-guest',
  })
  async removeMember(
    @Param('id') id: string,
    @Param('user_id') targetUserId: string,
    @CurrentUser() user: any,
  ) {
    return this.groupsService.removeMember(id, user.id, targetUserId);
  }

  @Post(':id/leave')
  @UseGuards(GroupMemberGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Leave a group voluntarily' })
  @ApiResponse({ status: 204, description: 'Left group' })
  @ApiResponse({ status: 400, description: 'sole_admin_cannot_leave' })
  async leaveGroup(@Param('id') id: string, @CurrentUser() user: any) {
    return this.groupsService.leaveGroup(id, user.id);
  }

  @Post(':id/regenerate_invite')
  @UseGuards(GroupMemberGuard)
  @Roles(GroupRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate group invite code (ADMIN only)' })
  @ApiResponse({ status: 200, description: 'New invite code generated' })
  async regenerateInviteCode(@Param('id') id: string) {
    return this.groupsService.regenerateInviteCode(id);
  }
}
