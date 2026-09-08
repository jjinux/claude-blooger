import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module.js'
import { PostsModule } from '../posts/posts.module.js'
import { UserEntity } from '../users/user.entity.js'
import { AdminController } from './admin.controller.js'
import { AdminService } from './admin.service.js'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), AuthModule, PostsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
