import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
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
  ],
  controllers: [HealthController],
})
export class AppModule {}
