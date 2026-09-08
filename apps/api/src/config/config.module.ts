import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { resolve } from 'node:path'
import { loadEnv, type Env } from './env.js'
import { REPO_ROOT } from './paths.js'

/** Injection token for the fully parsed, fully typed environment. */
export const ENV = 'BLOOGER_ENV'

/**
 * Wraps @nestjs/config so that consumers inject a typed `Env` object rather than
 * making stringly-keyed `configService.get()` calls. Zod does the validating;
 * Nest simply refuses to boot if it throws.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(REPO_ROOT, '.env'),
      cache: true,
      validate: (raw) => loadEnv(raw as NodeJS.ProcessEnv),
    }),
  ],
  providers: [{ provide: ENV, useFactory: (): Env => loadEnv() }],
  exports: [ENV, ConfigModule],
})
export class AppConfigModule {}
