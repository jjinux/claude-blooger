import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { UserEntity } from '../users/user.entity.js'
import { UsersService } from '../users/users.service.js'
import { AccountController } from './account.controller.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { AdminGuard } from './guards/admin.guard.js'
import { AuthenticatedGuard } from './guards/authenticated.guard.js'
import { SessionEntity } from './session.entity.js'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, SessionEntity])],
  controllers: [AuthController, AccountController],
  providers: [AuthService, UsersService, AuthenticatedGuard, AdminGuard],
  // Exported so feature modules can guard their own routes without re-wiring.
  exports: [AuthService, UsersService, AuthenticatedGuard, AdminGuard, TypeOrmModule],
})
export class AuthModule {}
