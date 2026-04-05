import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, readFileSync } from 'node:fs';

@Injectable()
export class SecretService {
  constructor(private readonly configService: ConfigService) {}

  getOptionalSecret(name: string) {
    const secretFilePath = this.configService.get<string>(`${name}_FILE`);

    if (secretFilePath) {
      if (!existsSync(secretFilePath)) {
        throw new Error(`Secret file for ${name} does not exist: ${secretFilePath}`);
      }

      return readFileSync(secretFilePath, 'utf8').trim();
    }

    return this.configService.get<string>(name) ?? undefined;
  }

  getRequiredSecret(name: string) {
    const secretValue = this.getOptionalSecret(name);

    if (!secretValue) {
      throw new Error(`Missing required secret: ${name}`);
    }

    return secretValue;
  }
}
