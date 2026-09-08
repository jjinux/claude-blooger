import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { loadEnv } from './config/env.js'

async function bootstrap(): Promise<void> {
  const env = loadEnv()
  const app = await NestFactory.create(AppModule)

  // Feeds and sitemap.xml will be registered outside this prefix, since they are
  // not part of the JSON API; add them to `exclude` when those routes land.
  app.setGlobalPrefix('api')

  await app.listen(env.PORT)
  Logger.log(`API listening on http://localhost:${env.PORT}/api`, 'Bootstrap')
}

void bootstrap()
