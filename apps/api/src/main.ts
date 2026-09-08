import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { configureApp } from './bootstrap.js'
import { loadEnv } from './config/env.js'

async function bootstrap(): Promise<void> {
  const env = loadEnv()
  const app = await NestFactory.create(AppModule)

  configureApp(app, env)

  await app.listen(env.PORT)
  Logger.log(`API listening on http://localhost:${env.PORT}/api`, 'Bootstrap')
}

void bootstrap()
