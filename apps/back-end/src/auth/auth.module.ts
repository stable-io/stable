import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";

@Module({
  imports: [
    JwtModule.registerAsync({
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
  exports: [JwtModule],
})
export class AuthModule {}
