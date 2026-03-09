import { z, ZodError, ZodType } from 'zod';
import { AppError } from '../errors';

export async function validateWithSchema<T>(
  schema: ZodType<T>,
  input: unknown
): Promise<T> {
  try {
    return await schema.parseAsync(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new AppError(400, 'Request validation failed', 'VALIDATION_ERROR', {
        details: error.issues.map((issue) => issue.message)
      });
    }

    throw error;
  }
}

export { z };
