import { Controller, Get } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { z } from 'zod'

const healthSchema = z.object({
  status: z.literal('ok'),
  database: z.string().describe('The schema the app is actually connected to.'),
})

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Cheap liveness probe that proves the database round-trips, not just that Nest booted. */
  @Get()
  @ApiOperation({
    summary: 'Liveness',
    description:
      'Round-trips a query, so it proves the database answers rather than only that Nest booted.',
  })
  @ApiOkResponse({ standardSchema: healthSchema })
  async check(): Promise<{ status: string; database: string }> {
    await this.dataSource.query('SELECT 1')
    return { status: 'ok', database: this.dataSource.options.database as string }
  }
}
