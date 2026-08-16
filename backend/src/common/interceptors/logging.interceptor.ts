import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ method: string; url: string }>();
    const { method, url } = request;
    const started = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context
            .switchToHttp()
            .getResponse<{ statusCode: number }>();
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${Date.now() - started}ms`,
          );
        },
        error: (error: { status?: number }) => {
          const status = error.status ?? 500;
          this.logger.warn(
            `${method} ${url} ${status} ${Date.now() - started}ms`,
          );
        },
      }),
    );
  }
}
