import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SessionGuard } from '../../common/guards/session.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AdminService } from './admin.service';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('admin')
@ApiCookieAuth()
@UseGuards(SessionGuard, RolesGuard)
@Roles('owner', 'admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users for the admin console' })
  listUsers(@Query() query: ListUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/role')
  @Roles('owner')
  @ApiOperation({ summary: 'Update a user role' })
  updateRole(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto
  ) {
    return this.adminService.updateRole(currentUser, id, dto);
  }
}
