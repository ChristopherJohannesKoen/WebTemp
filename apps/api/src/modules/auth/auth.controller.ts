import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SessionGuard } from '../../common/guards/session.guard';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
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

    response.cookie(
      this.authService.getCookieName(),
      result.token,
      this.authService.getCookieOptions(result.expiresAt)
    );

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

    response.cookie(
      this.authService.getCookieName(),
      result.token,
      this.authService.getCookieOptions(result.expiresAt)
    );

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
    response.clearCookie(this.authService.getCookieName(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/'
    });

    return { ok: true };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  @ApiCookieAuth()
  @ApiOkResponse({ description: 'Return the current session user' })
  me(@CurrentUser() currentUser: NonNullable<AuthenticatedRequest['currentUser']>) {
    return { user: currentUser };
  }

  @Post('password/forgot')
  @HttpCode(200)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password/reset')
  @HttpCode(200)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.authService.resetPassword(dto, {
      ipAddress: request.ip,
      userAgent: request.header('user-agent')
    });

    response.cookie(
      this.authService.getCookieName(),
      result.token,
      this.authService.getCookieOptions(result.expiresAt)
    );

    return { user: result.user };
  }
}
