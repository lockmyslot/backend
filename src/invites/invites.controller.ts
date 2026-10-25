import {
  Controller,
  Get,
  Post,
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
import { InvitesService } from './invites.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Invites')
@Controller('invites')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user pending group invites' })
  @ApiResponse({ status: 200, description: 'List of pending invites' })
  async getMyPendingInvites(@CurrentUser() user: any) {
    return this.invitesService.getMyPendingInvites(user.id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept a group invite' })
  @ApiResponse({ status: 200, description: 'Accepted invite and joined group' })
  async acceptInvite(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invitesService.acceptInvite(id, user.id);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Decline a group invite' })
  @ApiResponse({ status: 200, description: 'Declined group invite' })
  async declineInvite(@Param('id') id: string, @CurrentUser() user: any) {
    return this.invitesService.declineInvite(id, user.id);
  }
}
