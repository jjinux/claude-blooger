import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common'
import type { StandardSchemaV1 } from '@standard-schema/spec'
import type { FieldError } from '@blooger/shared'

/**
 * Validates any parameter that declared a schema, e.g.
 * `@Body({ schema: loginSchema })`.
 *
 * Registered once, globally, in AppModule. The schema arrives on
 * `ArgumentMetadata.schema` -- Nest 12 carries it there from the parameter
 * decorator -- which is what lets one declaration serve two purposes:
 * this pipe validates against it, and @nestjs/swagger reads the same object to
 * describe the endpoint at /api/docs. Documenting a body separately from
 * validating it is how the two end up disagreeing.
 *
 * It speaks Standard Schema rather than zod directly. The schemas in
 * @blooger/shared are zod, and zod 4 implements that interface; nothing here
 * needs to know which library produced them.
 *
 * Zod strips unknown keys from object schemas by default, which gives the same
 * protection Nest's ValidationPipe gets from `whitelist: true` -- a client cannot
 * smuggle in an `isAdmin` field and have it reach the entity.
 */
@Injectable()
export class SchemaValidationPipe implements PipeTransform<unknown, unknown> {
  async transform(value: unknown, metadata: ArgumentMetadata): Promise<unknown> {
    const schema = metadata.schema as StandardSchemaV1 | undefined
    if (!schema) return value

    const result = await schema['~standard'].validate(value)

    if (result.issues) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.issues.map(toFieldError),
      })
    }

    return result.value
  }
}

function toFieldError(issue: StandardSchemaV1.Issue): FieldError {
  const path = (issue.path ?? [])
    .map((segment) => (typeof segment === 'object' ? String(segment.key) : String(segment)))
    .join('.')

  return { field: path || '(root)', message: issue.message }
}
