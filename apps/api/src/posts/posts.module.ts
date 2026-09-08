import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { PostEntity } from './post.entity.js'
import { PostsController } from './posts.controller.js'
import { PostsService } from './posts.service.js'

@Module({
  // AuthModule supplies AuthenticatedGuard and the UsersService it depends on.
  imports: [TypeOrmModule.forFeature([PostEntity]), AuthModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService, TypeOrmModule],
})
export class PostsModule {}
