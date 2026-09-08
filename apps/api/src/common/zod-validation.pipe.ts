import { BadRequestException, type PipeTransform } from '@nestjs/common'
import type { ZodType } from 'zod'

/**
 * Validates a request body against a Zod schema from @blooger/shared.
 *
 * Zod strips unknown keys from object schemas by default, which gives the same
 * protection Nest's ValidationPipe gets from `whitelist: true` -- a client cannot
 * smuggle in an `isAdmin` field and have it reach the entity.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value)

    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.') || '(root)',
          message: issue.message,
        })),
      })
    }

    return result.data
  }
}
