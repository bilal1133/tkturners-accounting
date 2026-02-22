import { z, ZodTypeAny } from 'zod';

export function getZodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message || 'Invalid form input.';
}

export function validateWithSchema<TSchema extends ZodTypeAny>(
  schema: TSchema,
  input: unknown
): { success: true; data: z.infer<TSchema> } | { success: false; message: string } {
  const result = schema.safeParse(input);
  if (!result.success) {
    return {
      success: false,
      message: getZodErrorMessage(result.error),
    };
  }

  return {
    success: true,
    data: result.data,
  };
}
