import { Controller, Get } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Cheap liveness probe that proves the database round-trips, not just that Nest booted. */
  @Get()
  async check(): Promise<{ status: string; database: string }> {
    await this.dataSource.query('SELECT 1')
    return { status: 'ok', database: this.dataSource.options.database as string }
  }
}
