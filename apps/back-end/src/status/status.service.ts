import { Injectable } from "@nestjs/common";

@Injectable()
export class StatusService {
  public getStatus(): string {
    return "OK";
  }
} 