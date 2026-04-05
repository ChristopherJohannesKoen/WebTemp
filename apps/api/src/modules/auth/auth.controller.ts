import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
  UseInterceptors
} from '@nestjs/common';
import { ApiCookieAuth, ApiHeader, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionGuard } from '../../common/guards/session.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { IdempotencyInterceptor } from '../idempotency/idempotency.interceptor';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { StepUpDto } from './dto/step-up.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiOperation({ summary: 'Register a new account' })
  async signup(
    @Body() dto: SignupDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.signUp(dto, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    this.applySessionCookie(response, result.token, result.expiresAt);

    return { user: result.user };
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create a new authenticated session' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.login(dto, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    this.applySessionCookie(response, result.token, result.expiresAt);

    return { user: result.user };
  }

  @Post('break-glass/login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create an audited break-glass session for emergency owner access' })
  async breakGlassLogin(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.breakGlassLogin(dto, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    this.applySessionCookie(response, result.token, result.expiresAt);

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Destroy the active session' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.authService.logout(request.sessionToken, currentUser.id);
    response.clearCookie(
      this.authService.getCookieName(),
      this.authService.getClearCookieOptions()
    );

    return { ok: true };
  }

  @Get('csrf')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Issue a synchronizer CSRF token for the active session' })
  async csrf(@Req() request: AuthenticatedRequest) {
    return {
      csrfToken: await this.authService.issueCsrfToken(request.currentSession!.id)
    };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Return the current session user' })
  me(@CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>) {
    return { user: currentUser };
  }

  @Get('sessions')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List active sessions for the current user' })
  listSessions(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>
  ) {
    return this.authService.listSessions(currentUser, request.currentSession?.id);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke a single session for the current user' })
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Param('sessionId') sessionId: string,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.revokeSession(
      currentUser,
      sessionId,
      request.currentSession?.id
    );

    if (result.revokedCurrent) {
      response.clearCookie(
        this.authService.getCookieName(),
        this.authService.getClearCookieOptions()
      );
    }

    return result;
  }

  @Post('password/forgot')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password/reset')
  @HttpCode(200)
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const user = await this.authService.completePasswordReset(dto);
    const session = await this.authService.issueSessionForUser(user.id, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent'),
      authMethod: 'local',
      authReason: 'password_reset'
    });

    this.applySessionCookie(response, session.token, session.expiresAt);

    return { user };
  }

  @Post('step-up')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Require a fresh owner confirmation before a privileged action' })
  stepUp(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Req() request: AuthenticatedRequest,
    @Body() dto: StepUpDto
  ) {
    return this.authService.completeStepUp(currentUser, request.currentSession!, dto.password);
  }

  @Post('logout-all')
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke every active session for the current user' })
  async logoutAll(
    @CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.logoutAll(currentUser);
    response.clearCookie(
      this.authService.getCookieName(),
      this.authService.getClearCookieOptions()
    );
    return result;
  }

  private applySessionCookie(response: Response, token: string, expiresAt: Date) {
    response.cookie(
      this.authService.getCookieName(),
      this.authService.encodeSessionCookieToken(token),
      this.authService.getCookieOptions(expiresAt)
    );
  }
}
