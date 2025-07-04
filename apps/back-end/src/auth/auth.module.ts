import { Module } from "@nestjs/common";
import { JwtModule as NestJwtModule } from "@nestjs/jwt";
import { Validator } from "class-validator";
import { ConfigModule } from "../config/config.module";
import { ConfigService } from "../config/config.service";
import { IsSignedJwtConstraint } from "./validators";
import { JwtService } from "./jwt.service";

const JWT_ALGORITHM = "HS256";

@Module({
  imports: [
    NestJwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: ({ jwtSecret, jwtExpiresInSeconds }: ConfigService) => ({
        secret: jwtSecret,
        signOptions: {
          algorithm: JWT_ALGORITHM,
          expiresIn: jwtExpiresInSeconds,
        },
        verifyOptions: {
          algorithms: [JWT_ALGORITHM],
        },
      }),
    }),
  ],
  providers: [
    JwtService,
    IsSignedJwtConstraint,
    {
      provide: Validator,
      useValue: new Validator(),
    },
  ],
  exports: [JwtService],
})
export class AuthModule {}
