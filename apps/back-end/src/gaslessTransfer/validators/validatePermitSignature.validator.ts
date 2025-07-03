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

    const hasPermit = !!value;

    if (jwtPayload.quoteRequest.permit2PermitRequired !== hasPermit) {
      return false;
    }

    if (hasPermit && typeof value === "object") {
      const permit = value as Record<string, unknown>;
      // Check that the permit has the required signature field
      // The actual signature validation will be handled by @IsSignature on the signature field
      return "signature" in permit && permit["signature"] !== undefined;
    }

    return true;
  }

  defaultMessage(args: ValidationArguments) {
    const dto = args.object as Readonly<Record<string, unknown>>;
    const hasPermit = !!dto["permit"];
    if (!hasPermit) {
      return "permit must be provided when permit2PermitRequired is true in the quote";
    }

    const permit = dto["permit"] as Record<string, unknown>;
    const tempArgs = {
      ...args,
      property: "signature",
      object: permit,
    };

    return this.isSignatureValidator.validate(permit["signature"], tempArgs)
      ? "permit must not be provided when permit2PermitRequired is false in the quote"
      : this.isSignatureValidator.defaultMessage(tempArgs);
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
