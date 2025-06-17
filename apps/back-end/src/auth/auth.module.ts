import { Module } from "@nestjs/common";
import { JwtModule as NestJwtModule } from "@nestjs/jwt";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { JwtService } from "./jwt.service";

@Module({
  imports: [
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: ({ jwtSecret, jwtExpiresInSeconds }: ConfigService) => ({
        secret: jwtSecret,
        signOptions: {
          algorithm: "HS256",
          expiresIn: jwtExpiresInSeconds,
        },
      }),
    }),
  ],
  providers: [JwtService],
  exports: [JwtService],
})
export class AuthModule {}
