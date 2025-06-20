import { Injectable } from "@nestjs/common";
import { JwtService as NestJwtService } from "@nestjs/jwt";
import { serializeBigints, deserializeBigints } from "@stable-io/utils";

@Injectable()
export class JwtService {
  constructor(private readonly nestJwtService: NestJwtService) {}

  async signAsync(payload: Record<string, unknown>): Promise<string> {
    const jsonSafePayload = serializeBigints(payload);
    return this.nestJwtService.signAsync(jsonSafePayload);
  }

  async verifyAsync<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(token: string): Promise<T> {
    const decoded =
      await this.nestJwtService.verifyAsync<Record<string, unknown>>(token);
    return deserializeBigints<T>(decoded);
  }

  decode<T extends Record<string, unknown> = Record<string, unknown>>(
    token: string,
  ): T {
    const decoded = this.nestJwtService.decode<Record<string, unknown>>(token);
    return deserializeBigints<T>(decoded);
  }

  async verifyAsyncRaw<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(token: string): Promise<T> {
    return this.nestJwtService.verifyAsync<T>(token);
  }

  decodeRaw<T extends Record<string, unknown> = Record<string, unknown>>(
    token: string,
  ): T {
    return this.nestJwtService.decode<T>(token);
  }
}
