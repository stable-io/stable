import { Inject, Injectable } from "@nestjs/common";
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from "class-validator";
import { JwtService } from "../../auth/jwt.service";
import { IsSignatureConstraint } from "../../common/validators/isSignature.validator";
import type { JwtPayload } from "../types";

@ValidatorConstraint({ name: "validatePermitSignature", async: true })
@Injectable()
export class ValidatePermitSignatureConstraint
  implements ValidatorConstraintInterface
{
  private readonly isSignatureValidator = new IsSignatureConstraint();

  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  async validate(value: unknown, args: ValidationArguments) {
    const dto = args.object as Readonly<Record<string, unknown>>;

    let jwtPayload: JwtPayload;
    try {
      jwtPayload = await this.jwtService.verifyAsyncRaw(dto["jwt"] as string);
    } catch {
      // @note: If JWT is invalid, let the @IsSignedJwt validator handle it
      return true;
    }

    const hasSignature = !!value;

    if (jwtPayload.quoteRequest.permit2PermitRequired !== hasSignature) {
      return false;
    }

    if (hasSignature) {
      return this.isSignatureValidator.validate(value, args);
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const dto = args.object as Readonly<Record<string, unknown>>;
    const hasSignature = !!dto["permitSignature"];
    if (!hasSignature) {
      return "permitSignature must be provided when permit2PermitRequired is true in the quote";
    }

    const tempArgs = {
      ...args,
      object: { [args.property]: dto["permitSignature"] },
    };
    // @todo: Check whether signature is required first?
    return this.isSignatureValidator.validate(dto["permitSignature"], tempArgs)
      ? "permitSignature must not be provided when permit2PermitRequired is false in the quote"
      : this.isSignatureValidator.defaultMessage(args);
  }
}

export function ValidatePermitSignature(validationOptions?: ValidationOptions) {
  return function (target: any, propertyName: string) {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName,
      options: validationOptions || {},
      constraints: [],
      validator: ValidatePermitSignatureConstraint,
    });
  };
}
