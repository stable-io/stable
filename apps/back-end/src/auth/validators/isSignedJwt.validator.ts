import { Inject, Injectable } from "@nestjs/common";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationError,
  registerDecorator,
  ValidationOptions,
  Validator,
} from "class-validator";
import { plainToInstance } from "class-transformer";
import { JwtService } from "../jwt.service";
import { JwtPayloadDto } from "../../gaslessTransfer/dto/jwtPayload.dto";

@ValidatorConstraint({ name: "isSignedJwt", async: true })
@Injectable()
export class IsSignedJwtConstraint implements ValidatorConstraintInterface {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    private readonly validator: Validator,
  ) {}

  async validate(value: unknown, args: ValidationArguments): Promise<boolean> {
    if (typeof value !== "string") return false;

    try {
      const payload = await this.jwtService.verifyAsync(value);

      const jwtPayloadInstance = plainToInstance(JwtPayloadDto, payload, {
        enableImplicitConversion: true,
        excludeExtraneousValues: false,
      });

      const validationErrors =
        await this.validator.validate(jwtPayloadInstance);
      if (validationErrors.length > 0) {
        (args as any).validationErrors = validationErrors;
        return false;
      }

      // @note: Transform the value from JWT string to validated payload DTO instance
      (args.object as any)[args.property] = jwtPayloadInstance;
      return true;
    } catch (error) {
      (args as any).jwtError = error;
      return false;
    }
  }

  defaultMessage(args?: ValidationArguments): string {
    const validationErrors = (args as { validationErrors?: ValidationError[] })
      .validationErrors;
    const jwtError = (args as any)?.jwtError;

    if (validationErrors && validationErrors.length > 0) {
      const errorMessages = validationErrors
        .map((error: any) => Object.values(error.constraints || {}).join(", "))
        .join("; ");
      return `JWT payload validation failed: ${errorMessages}`;
    }

    if (jwtError) {
      return `JWT verification failed: ${jwtError.message}`;
    }

    return "Invalid JWT";
  }
}

export function IsSignedJwt(validationOptions?: ValidationOptions) {
  return function (obj: object, propertyName: string) {
    registerDecorator({
      target: obj.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: IsSignedJwtConstraint,
    });
  };
}
