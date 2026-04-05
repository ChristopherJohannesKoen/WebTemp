import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards
} from '@nestjs/common';
import { ApiExcludeController, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { SessionService } from '../auth/session.service';
import { IdentityService } from './identity.service';
import { ScimGuard } from './scim.guard';

@ApiTags('auth')
@Controller('auth')
export class IdentityController {
  constructor(
    private readonly identityService: IdentityService,
    private readonly sessionService: SessionService
  ) {}

  @Get('sso/providers')
  @ApiOperation({ summary: 'List active enterprise identity providers' })
  listProviders() {
    return this.identityService.listProviders();
  }

  @Get('sso/:provider/start')
  @ApiOperation({ summary: 'Start an enterprise SSO redirect flow' })
  async startLogin(
    @Param('provider') provider: string,
    @Query('redirectTo') redirectTo: string | undefined,
    @Res() response: Response
  ) {
    const result = await this.identityService.startLogin(provider, redirectTo);
    response.redirect(result.redirectUrl);
  }

  @Get('sso/:provider/callback')
  @ApiOperation({ summary: 'Handle an OIDC enterprise sign-in callback' })
  async oidcCallback(
    @Param('provider') provider: string,
    @Query() query: Record<string, string | string[] | undefined>,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const result = await this.identityService.handleOidcCallback(provider, query, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    this.applySessionCookie(response, result.token, result.expiresAt);
    response.redirect(result.redirectTo);
  }

  @Post('sso/:provider/callback')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle a SAML enterprise sign-in callback' })
  async samlCallback(
    @Param('provider') provider: string,
    @Body('SAMLResponse') samlResponse: string | undefined,
    @Body('RelayState') relayState: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response
  ) {
    const result = await this.identityService.handleSamlCallback(
      provider,
      samlResponse,
      relayState,
      {
        ipAddress: request.ip,
        userAgent: request.header('user-agent')
      }
    );

    this.applySessionCookie(response, result.token, result.expiresAt);
    response.redirect(result.redirectTo);
  }

  private applySessionCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(
      this.sessionService.getCookieName(),
      this.sessionService.encodeSessionCookieToken(token),
      this.sessionService.getCookieOptions(expiresAt)
    );
  }
}

@ApiExcludeController()
@UseGuards(ScimGuard)
@Controller('scim/v2')
export class ScimController {
  constructor(private readonly identityService: IdentityService) {}

  @Get('Users')
  listUsers() {
    return this.identityService.listScimUsers();
  }

  @Post('Users')
  createUser(@Body() payload: unknown) {
    return this.identityService.upsertScimUser(payload);
  }

  @Put('Users/:id')
  updateUser(@Param('id') id: string, @Body() payload: unknown) {
    return this.identityService.upsertScimUser({
      ...(payload as Record<string, unknown>),
      externalId: id
    });
  }

  @Delete('Users/:id')
  deleteUser(@Param('id') id: string) {
    return this.identityService.disableScimUser(id);
  }

  @Get('Groups')
  listGroups() {
    return this.identityService.listScimGroups();
  }

  @Post('Groups')
  createGroup(@Body() payload: unknown) {
    return this.identityService.upsertScimGroup(payload);
  }

  @Put('Groups/:id')
  updateGroup(@Param('id') id: string, @Body() payload: unknown) {
    return this.identityService.upsertScimGroup({
      ...(payload as Record<string, unknown>),
      externalId: id
    });
  }
}
