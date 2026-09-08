import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module.js'
import { configureApp, registerApiNotFound } from './bootstrap.js'
import { loadEnv } from './config/env.js'

async function bootstrap(): Promise<void> {
  const env = loadEnv()
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  configureApp(app, env)

  // Routes are wired up by init(); the API's 404 handler has to come after them.
  await app.init()
  registerApiNotFound(app)

  await app.listen(env.PORT)
  Logger.log(`API listening on http://localhost:${env.PORT}/api`, 'Bootstrap')
}

void bootstrap()
