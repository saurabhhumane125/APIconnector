export class OutputValidationError extends Error {
  public errors: string[];
  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'OutputValidationError';
    this.errors = errors;
  }
}

/**
 * Robust JSON extraction from raw model outputs.
 * Handles markdown code blocks, preamble text, and JSON delimiters.
 */
export function extractJsonFromText(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new OutputValidationError('Model returned empty or non-string response');
  }

  const trimmed = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue to extract from fences or substring
  }

  // Check for ```json ... ``` or ``` ... ```
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // Continue to bracket search
    }
  }

  // Find first { and last } or first [ and last ]
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  const firstBracket = trimmed.indexOf('[');
  const lastBracket = trimmed.lastIndexOf(']');

  let start = -1;
  let end = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    start = firstBrace;
    end = lastBrace;
  } else if (firstBracket !== -1) {
    start = firstBracket;
    end = lastBracket;
  }

  if (start !== -1 && end > start) {
    const candidate = trimmed.substring(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch (err: any) {
      throw new OutputValidationError(`Failed to parse extracted JSON substring: ${err.message}`);
    }
  }

  throw new OutputValidationError('No valid JSON object or array could be detected in model output');
}

/**
 * Validates a parsed data object against a JSON schema.
 */
export function validateOutputAgainstSchema(
  data: any,
  schema: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [] };
  }

  const expectedType = schema.type;
  if (expectedType) {
    const actualType = Array.isArray(data) ? 'array' : typeof data;
    if (expectedType === 'object' && (actualType !== 'object' || data === null || Array.isArray(data))) {
      errors.push(`Expected root output to be an object, but got ${actualType}`);
    } else if (expectedType === 'array' && !Array.isArray(data)) {
      errors.push(`Expected root output to be an array, but got ${actualType}`);
    }
  }

  // Check required properties for object schemas
  if (schema.type === 'object' && data && typeof data === 'object' && !Array.isArray(data)) {
    if (Array.isArray(schema.required)) {
      for (const requiredProp of schema.required) {
        if (data[requiredProp] === undefined || data[requiredProp] === null) {
          errors.push(`Required field '${requiredProp}' is missing from AI response`);
        }
      }
    }

    // Check property types if declared
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [propName, propSchema] of Object.entries<any>(schema.properties)) {
        if (data[propName] !== undefined && data[propName] !== null) {
          const val = data[propName];
          const propExpectedType = propSchema.type;

          if (propExpectedType === 'string' && typeof val !== 'string') {
            errors.push(`Field '${propName}' must be a string, got ${typeof val}`);
          } else if (propExpectedType === 'number' && typeof val !== 'number') {
            errors.push(`Field '${propName}' must be a number, got ${typeof val}`);
          } else if (propExpectedType === 'boolean' && typeof val !== 'boolean') {
            errors.push(`Field '${propName}' must be a boolean, got ${typeof val}`);
          } else if (propExpectedType === 'array' && !Array.isArray(val)) {
            errors.push(`Field '${propName}' must be an array, got ${typeof val}`);
          } else if (propExpectedType === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
            errors.push(`Field '${propName}' must be an object, got ${typeof val}`);
          }

          // Check enum if declared
          if (Array.isArray(propSchema.enum) && !propSchema.enum.includes(val)) {
            errors.push(`Field '${propName}' value '${val}' is not in allowed enum [${propSchema.enum.join(', ')}]`);
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
