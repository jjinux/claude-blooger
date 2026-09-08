import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from './auth/auth.module.js'
import { CsrfGuard } from './auth/guards/csrf.guard.js'
import { RateLimitGuard } from './common/rate-limit.guard.js'
import { AppConfigModule } from './config/config.module.js'
import { loadEnv } from './config/env.js'
import { buildDataSourceOptions } from './database/data-source.js'
import { HealthController } from './health/health.controller.js'

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      // Same options builder the TypeORM CLI uses, so the app and its migrations
      // can never be pointed at differently-configured schemas.
      useFactory: () => buildDataSourceOptions(loadEnv()),
    }),
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    // Registered as ordinary providers and bound with useExisting, so there is a
    // single instance per guard that tests can retrieve with app.get(). Binding
    // with useClass instead would construct a second, unreachable instance.
    RateLimitGuard,
    CsrfGuard,
    // Order matters: rate limiting runs first so a flood is rejected before it
    // reaches any further work.
    { provide: APP_GUARD, useExisting: RateLimitGuard },
    { provide: APP_GUARD, useExisting: CsrfGuard },
  ],
})
export class AppModule {}
