import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionGuard } from '../../common/guards/session.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@UseGuards(SessionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Return the current user profile' })
  me(@CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>) {
    return this.usersService.me(currentUser.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  updateMe(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Body() dto: UpdateProfileDto
  ) {
    return this.usersService.updateMe(currentUser.id, dto);
  }
}
