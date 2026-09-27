import { InputParameterDef } from '../providers/types';

export interface FieldValidationError {
  field: string;
  message: string;
  expectedType?: string;
  receivedValue?: any;
}

export interface ValidationResult {
  valid: boolean;
  sanitizedInputs: Record<string, any>;
  errors: FieldValidationError[];
}

/**
 * Validates external client request payloads against a connector's dynamic input parameter definitions.
 */
export function validateAndSanitizeInputs(
  rawInputs: Record<string, any> | undefined | null,
  paramDefs: InputParameterDef[]
): ValidationResult {
  const inputs = rawInputs && typeof rawInputs === 'object' ? rawInputs : {};
  const sanitizedInputs: Record<string, any> = {};
  const errors: FieldValidationError[] = [];

  for (const def of paramDefs) {
    let value = inputs[def.name];

    // Handle missing / undefined / null value
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      if (def.required) {
        errors.push({
          field: def.name,
          message: `Required parameter '${def.name}' is missing or empty`,
          expectedType: def.type,
        });
        continue;
      } else if (def.defaultValue !== undefined && def.defaultValue !== null && def.defaultValue !== '') {
        // Coerce default value according to type
        value = coerceDefaultValue(def.defaultValue, def.type);
      } else {
        // Optional and not provided
        continue;
      }
    }

    const typeCheck = validateAndCoerceType(value, def.type);
    if (!typeCheck.valid) {
      errors.push({
        field: def.name,
        message: typeCheck.errorMessage || `Parameter '${def.name}' has invalid type. Expected ${def.type}`,
        expectedType: def.type,
        receivedValue: typeof value === 'object' ? JSON.stringify(value) : value,
      });
      continue;
    }

    const coercedValue = typeCheck.coercedValue;

    // Apply specific validation rules if configured
    if (def.validationRules && typeof def.validationRules === 'object') {
      const rules = def.validationRules;

      // Numeric range
      if (def.type === 'number') {
        if (typeof rules.min === 'number' && coercedValue < rules.min) {
          errors.push({ field: def.name, message: `'${def.name}' must be at least ${rules.min}` });
        }
        if (typeof rules.max === 'number' && coercedValue > rules.max) {
          errors.push({ field: def.name, message: `'${def.name}' cannot exceed ${rules.max}` });
        }
      }

      // String length and regex
      if (def.type === 'text') {
        if (typeof rules.min_length === 'number' && coercedValue.length < rules.min_length) {
          errors.push({ field: def.name, message: `'${def.name}' must be at least ${rules.min_length} characters` });
        }
        if (typeof rules.max_length === 'number' && coercedValue.length > rules.max_length) {
          errors.push({ field: def.name, message: `'${def.name}' cannot exceed ${rules.max_length} characters` });
        }
        if (typeof rules.regex === 'string') {
          try {
            const re = new RegExp(rules.regex);
            if (!re.test(coercedValue)) {
              errors.push({ field: def.name, message: `'${def.name}' does not match required pattern` });
            }
          } catch {
            // Invalid regex config ignored safely
          }
        }
      }

      // Allowed values / Enum
      if (Array.isArray(rules.allowed_values)) {
        if (!rules.allowed_values.includes(coercedValue)) {
          errors.push({
            field: def.name,
            message: `'${def.name}' value must be one of: [${rules.allowed_values.join(', ')}]`,
          });
        }
      }

      // Image & File size checks (e.g. max base64 payload size)
      if ((def.type === 'image' || def.type === 'file') && typeof rules.max_size_mb === 'number') {
        const sizeInBytes = typeof coercedValue === 'string' ? coercedValue.length : 0;
        const maxBytes = rules.max_size_mb * 1024 * 1024 * 1.37; // Account for base64 encoding overhead
        if (sizeInBytes > maxBytes) {
          errors.push({
            field: def.name,
            message: `'${def.name}' exceeds maximum allowed size of ${rules.max_size_mb}MB`,
          });
        }
      }
    }

    sanitizedInputs[def.name] = coercedValue;
  }

  return {
    valid: errors.length === 0,
    sanitizedInputs,
    errors,
  };
}

function coerceDefaultValue(defaultStr: string, type: string): any {
  if (type === 'number') {
    const num = Number(defaultStr);
    return isNaN(num) ? defaultStr : num;
  }
  if (type === 'boolean') {
    return defaultStr.toLowerCase() === 'true' || defaultStr === '1';
  }
  if (type === 'json') {
    try {
      return JSON.parse(defaultStr);
    } catch {
      return defaultStr;
    }
  }
  return defaultStr;
}

function validateAndCoerceType(
  value: any,
  type: string
): { valid: boolean; coercedValue?: any; errorMessage?: string } {
  switch (type) {
    case 'text':
      if (typeof value === 'string') return { valid: true, coercedValue: value };
      if (typeof value === 'number' || typeof value === 'boolean') {
        return { valid: true, coercedValue: String(value) };
      }
      return { valid: false, errorMessage: `Expected string, received ${typeof value}` };

    case 'number':
      if (typeof value === 'number' && !isNaN(value)) {
        return { valid: true, coercedValue: value };
      }
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (!isNaN(parsed)) return { valid: true, coercedValue: parsed };
      }
      return { valid: false, errorMessage: `Expected numeric value, received '${value}'` };

    case 'boolean':
      if (typeof value === 'boolean') return { valid: true, coercedValue: value };
      if (typeof value === 'string') {
        const lower = value.toLowerCase().trim();
        if (lower === 'true' || lower === '1') return { valid: true, coercedValue: true };
        if (lower === 'false' || lower === '0') return { valid: true, coercedValue: false };
      }
      return { valid: false, errorMessage: `Expected boolean (true/false), received '${value}'` };

    case 'image':
      if (typeof value !== 'string') {
        return { valid: false, errorMessage: 'Expected image as a base64 data URI string or URL' };
      }
      const isBase64Data = value.startsWith('data:image/');
      const isHttpUrl = value.startsWith('http://') || value.startsWith('https://');
      const isRawBase64 = value.length > 50 && /^[A-Za-z0-9+/=]+$/.test(value.replace(/[\r\n\s]/g, ''));
      if (!isBase64Data && !isHttpUrl && !isRawBase64) {
        return {
          valid: false,
          errorMessage: 'Image must be a valid base64 data URI (data:image/...) or accessible HTTP/HTTPS URL',
        };
      }
      return { valid: true, coercedValue: value };

    case 'file':
      if (typeof value !== 'string') {
        return { valid: false, errorMessage: 'File must be a base64 data URI or string content' };
      }
      return { valid: true, coercedValue: value };

    case 'json':
      if (typeof value === 'object' && value !== null) {
        return { valid: true, coercedValue: value };
      }
      if (typeof value === 'string') {
        try {
          return { valid: true, coercedValue: JSON.parse(value) };
        } catch {
          return { valid: false, errorMessage: 'Expected valid JSON object or array' };
        }
      }
      return { valid: false, errorMessage: `Expected JSON object or array, received ${typeof value}` };

    default:
      return { valid: true, coercedValue: value };
  }
}
