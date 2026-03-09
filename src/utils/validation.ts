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
      // Controllers use one shared validation path so API error responses stay consistent.
      throw new AppError(400, 'Request validation failed', 'VALIDATION_ERROR', {
        details: error.issues.map((issue) => issue.message)
      });
    }

    throw error;
  }
}

export async function validateUuidParam(value: unknown, fieldName: string): Promise<string> {
  return validateWithSchema(
    z.string().uuid(`${fieldName} must be a valid UUID`),
    value
  );
}

export { z };
