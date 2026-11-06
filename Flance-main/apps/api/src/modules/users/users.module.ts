import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";
import { SupabaseMediaStorageService } from "./supabase-media-storage.service";

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_SECRET,
      }),
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService, SupabaseMediaStorageService],
  exports: [UsersService],
})
export class UsersModule {}

