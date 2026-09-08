import { Module } from '@nestjs/common'
import { BloogsModule } from '../bloogs/bloogs.module.js'
import { PostsModule } from '../posts/posts.module.js'
import { FeedsController } from './feeds.controller.js'
import { FeedsService } from './feeds.service.js'

@Module({
  imports: [PostsModule, BloogsModule],
  controllers: [FeedsController],
  providers: [FeedsService],
})
export class FeedsModule {}
