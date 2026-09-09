import type { ErrorResponse, FieldError } from '@blooger/shared'
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * Gives every failure the same body, whatever threw it.
 *
 * Without this the shape depends on how the exception happened to be built:
 * `new ConflictException('Username is taken')` yields
 * `{ statusCode, error, message }`, while `new BadRequestException({ ... })`
 * replaces that wholesale and loses `statusCode` entirely -- which is exactly
 * what the validation pipe was doing. A client then has to know which endpoints
 * fail in which dialect.
 *
 * The shape is `errorResponseSchema` in @blooger/shared, so the SPA parses what
 * this emits and the OpenAPI document describes it.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR
    const payload = exception instanceof HttpException ? exception.getResponse() : undefined

    // Anything that is not a deliberate HttpException is a bug. Log it with the
    // stack, and tell the client nothing beyond the status -- an exception
    // message can carry a query, a path, or a name that is nobody's business.
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    const body: ErrorResponse = {
      statusCode: status,
      error: reasonPhrase(status),
      message:
        status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : messageFrom(payload, status),
    }

    const errors = fieldErrorsFrom(payload)
    if (errors) body.errors = errors

    response.status(status).json(body)
  }
}

/**
 * "Bad Request" from HttpStatus.BAD_REQUEST, rather than a hand-kept table that
 * would be missing whichever status someone adds next.
 */
function reasonPhrase(status: number): string {
  const name = HttpStatus[status] as string | undefined
  if (!name) return 'Error'

  return name
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function messageFrom(payload: unknown, status: number): string {
  if (typeof payload === 'string') return payload

  if (isRecord(payload)) {
    const { message } = payload
    if (typeof message === 'string') return message
    // Nest's own ValidationPipe emits an array here. Nothing in this app does,
    // but a client should never be handed a JSON array where a string is
    // documented.
    if (Array.isArray(message)) return message.map(String).join(', ')
  }

  return reasonPhrase(status)
}

function fieldErrorsFrom(payload: unknown): FieldError[] | undefined {
  if (!isRecord(payload) || !Array.isArray(payload.errors)) return undefined

  const errors = payload.errors.filter(
    (entry): entry is FieldError =>
      isRecord(entry) && typeof entry.field === 'string' && typeof entry.message === 'string',
  )

  return errors.length > 0 ? errors : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
