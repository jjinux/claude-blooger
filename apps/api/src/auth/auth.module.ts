import { Module } from '@nestjs/common'
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm'
import type { Repository } from 'typeorm'
import { UserEntity } from '../users/user.entity.js'
import { UsersService } from '../users/users.service.js'
import { AccountController } from './account.controller.js'
import { AuthController } from './auth.controller.js'
import { AuthService } from './auth.service.js'
import { AdminGuard } from './guards/admin.guard.js'
import { AuthenticatedGuard } from './guards/authenticated.guard.js'
import { SessionEntity } from './session.entity.js'
import { SessionSweeper } from './session-sweeper.js'
import { TypeOrmSessionStore } from './typeorm-session.store.js'

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, SessionEntity])],
  controllers: [AuthController, AccountController],
  providers: [
    AuthService,
    UsersService,
    AuthenticatedGuard,
    AdminGuard,
    // A provider rather than a `new` in bootstrap.ts, so the sweeper below can be
    // handed the same instance and Nest's lifecycle can start and stop it.
    {
      provide: TypeOrmSessionStore,
      useFactory: (sessions: Repository<SessionEntity>) => new TypeOrmSessionStore(sessions),
      inject: [getRepositoryToken(SessionEntity)],
    },
    SessionSweeper,
  ],
  // Exported so feature modules can guard their own routes without re-wiring.
  exports: [
    AuthService,
    UsersService,
    AuthenticatedGuard,
    AdminGuard,
    TypeOrmSessionStore,
    TypeOrmModule,
  ],
})
export class AuthModule {}
