import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { PostEntity } from '../posts/post.entity.js'
import { PostsModule } from '../posts/posts.module.js'
import { UserEntity } from '../users/user.entity.js'
import { BloogsController } from './bloogs.controller.js'
import { BloogsService } from './bloogs.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, PostEntity]), PostsModule],
  controllers: [BloogsController],
  providers: [BloogsService],
})
export class BloogsModule {}
