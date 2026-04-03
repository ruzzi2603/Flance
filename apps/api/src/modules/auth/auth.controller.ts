import { Body, Controller, Get, Post, Res, UseGuards, UsePipes, Req, UnauthorizedException, Query } from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser, JwtUserPayload } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyResetCodeSchema,
  type LoginInput,
  type RegisterInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type VerifyResetCodeInput,
} from "./schemas/auth.schema";
import { AuthService } from "./auth.service";
import { UsersService } from "../users/users.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post("register")
  @UsePipes(new ZodValidationPipe(registerSchema))
  async register(@Body() body: RegisterInput, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(body);
    this.setAuthCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("login")
  @UsePipes(new ZodValidationPipe(loginSchema))
  async login(@Body() body: LoginInput, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(body);
    this.setAuthCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: JwtUserPayload) {
    const entity = await this.usersService.findById(user.sub);
    if (!entity) {
      throw new UnauthorizedException("User not found");
    }
    return { success: true, data: this.usersService.toPublicUser(entity), timestamp: new Date().toISOString() };
  }

  @Post("refresh")
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.flance_refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is missing");
    }

    const result = await this.authService.refresh(refreshToken);
    this.setAuthCookie(response, result.accessToken);
    this.setRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: JwtUserPayload,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(user.sub);
    response.clearCookie("flance_access_token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
    response.clearCookie("flance_refresh_token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });

    return { success: true, data: { loggedOut: true }, timestamp: new Date().toISOString() };
  }

  @Post("password/forgot")
  @UsePipes(new ZodValidationPipe(forgotPasswordSchema))
  async forgotPassword(@Body() body: ForgotPasswordInput) {
    const result = await this.authService.requestPasswordReset(body.email);
    const response: { sent: boolean; resetUrl?: string } = { sent: result.sent };
    if (process.env.NODE_ENV !== "production" && result.resetUrl) {
      response.resetUrl = result.resetUrl;
    }
    return { success: true, data: response, timestamp: new Date().toISOString() };
  }

  @Get("password/verify-options")
  async verifyOptions(@Query("token") token?: string) {
    if (!token) {
      throw new UnauthorizedException("Reset token is missing");
    }
    const options = await this.authService.getResetOptions(token);
    return { success: true, data: { options }, timestamp: new Date().toISOString() };
  }

  @Post("password/verify")
  @UsePipes(new ZodValidationPipe(verifyResetCodeSchema))
  async verifyCode(@Body() body: VerifyResetCodeInput) {
    const resetToken = await this.authService.verifyResetCode(body.token, body.code);
    return { success: true, data: { resetToken }, timestamp: new Date().toISOString() };
  }

  @Post("password/reset")
  @UsePipes(new ZodValidationPipe(resetPasswordSchema))
  async resetPassword(@Body() body: ResetPasswordInput) {
    await this.authService.resetPassword(body.token, body.password);
    return { success: true, data: { reset: true }, timestamp: new Date().toISOString() };
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie("flance_access_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * Number(process.env.JWT_EXPIRES_IN_SECONDS || 3600),
      path: "/",
    });
  }

  private setRefreshCookie(response: Response, token: string) {
    response.cookie("flance_refresh_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * Number(process.env.JWT_REFRESH_EXPIRES_IN_SECONDS || 604800),
      path: "/",
    });
  }
}

