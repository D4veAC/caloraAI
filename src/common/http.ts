import { HttpException, HttpStatus } from '@nestjs/common';

export function httpError(message: string, status: number) {
  return new HttpException(message, status);
}

export function numeric(value: unknown, key: string, min: number, max: number) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw httpError(`Invalid ${key}`, HttpStatus.BAD_REQUEST);
  return n;
}
