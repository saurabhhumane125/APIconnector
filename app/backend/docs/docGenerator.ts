import { Connector } from '../connectors/types';
import { config } from '../config';

export interface GeneratedDoc {
  connectorId: string;
  name: string;
  slug: string;
  description: string;
  provider: string;
  model: string;
  status: string;
  authType: string;
  endpointUrl: string;
  httpMethod: string;
  headers: Record<string, string>;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: string;
    validationRules?: Record<string, any>;
    exampleValue: any;
  }>;
  sampleRequestBody: Record<string, any>;
  sampleCurlCommand: string;
  outputSchema: Record<string, any>;
  sampleSuccessResponse: Record<string, any>;
  sampleErrorResponse: Record<string, any>;
}

export function generateConnectorDocumentation(connector: Connector, baseUrl?: string): GeneratedDoc {
  const host = baseUrl || config.apiBaseUrl;
  const endpointUrl = `${host}/api/v1/run/${connector.slug}`;
  const httpMethod = 'POST';

  // Determine headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (connector.authType === 'api_key') {
    headers['X-API-Key'] = 'hub_live_YOUR_API_KEY';
  } else if (connector.authType === 'bearer_token') {
    headers['Authorization'] = 'Bearer hub_live_YOUR_API_KEY';
  }

  // Generate sample input values
  const sampleRequestBody: Record<string, any> = {};
  const parameters = connector.inputParameters.map(p => {
    let exampleValue: any = 'sample string';
    if (p.type === 'number') exampleValue = p.defaultValue ? Number(p.defaultValue) : 42;
    else if (p.type === 'boolean') exampleValue = p.defaultValue ? p.defaultValue === 'true' : true;
    else if (p.type === 'image') exampleValue = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...';
    else if (p.type === 'file') exampleValue = 'data:text/plain;base64,SGVsbG8gV29ybGQ=';
    else if (p.type === 'json') exampleValue = { key: 'value', count: 1 };
    else if (p.defaultValue) exampleValue = p.defaultValue;
    else if (p.name.includes('ticket') || p.name.includes('message')) exampleValue = 'My user login failed repeatedly on mobile app';
    else if (p.name.includes('currency')) exampleValue = 'USD';

    sampleRequestBody[p.name] = exampleValue;

    return {
      name: p.name,
      type: p.type,
      required: p.required,
      description: p.description || 'No description provided.',
      defaultValue: p.defaultValue,
      validationRules: p.validationRules,
      exampleValue,
    };
  });

  // Construct copyable cURL command
  const curlHeaders = Object.entries(headers)
    .map(([k, v]) => `  -H "${k}: ${v}"`)
    .join(' \\\n');
  const curlBody = JSON.stringify(sampleRequestBody, null, 2)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');

  const sampleCurlCommand = `curl -X POST "${endpointUrl}" \\\n${curlHeaders} \\\n  -d '{\n${curlBody}\n  }'`;

  // Construct sample responses based on output schema
  const sampleSuccessResponse = {
    success: true,
    data: generateSampleFromSchema(connector.outputSchema),
    error: null,
    meta: {
      requestId: 'req_a1b2c3d4e5',
      connectorId: connector.id,
      connectorSlug: connector.slug,
      provider: connector.provider,
      model: connector.model,
      durationMs: 312,
      tokens: {
        prompt: 154,
        completion: 48,
        total: 202,
      },
      estimatedCost: 0.000035,
    },
  };

  const sampleErrorResponse = {
    success: false,
    data: null,
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Invalid request input parameters.',
      details: [
        {
          field: parameters[0]?.name || 'field',
          message: `Required parameter '${parameters[0]?.name || 'field'}' is missing or empty`,
        },
      ],
    },
    meta: {
      requestId: 'req_fail_123',
      durationMs: 4,
    },
  };

  return {
    connectorId: connector.id,
    name: connector.name,
    slug: connector.slug,
    description: connector.description,
    provider: connector.provider,
    model: connector.model,
    status: connector.status,
    authType: connector.authType,
    endpointUrl,
    httpMethod,
    headers,
    parameters,
    sampleRequestBody,
    sampleCurlCommand,
    outputSchema: connector.outputSchema,
    sampleSuccessResponse,
    sampleErrorResponse,
  };
}

function generateSampleFromSchema(schema: any): any {
  if (!schema || typeof schema !== 'object') return {};
  if (schema.type === 'object' && schema.properties) {
    const obj: Record<string, any> = {};
    for (const [key, prop] of Object.entries<any>(schema.properties)) {
      if (prop.enum && prop.enum.length > 0) obj[key] = prop.enum[0];
      else if (prop.type === 'string') obj[key] = `sample_${key}`;
      else if (prop.type === 'number') obj[key] = 25.5;
      else if (prop.type === 'boolean') obj[key] = true;
      else if (prop.type === 'array') obj[key] = prop.items ? [generateSampleFromSchema(prop.items)] : [];
      else if (prop.type === 'object') obj[key] = generateSampleFromSchema(prop);
      else obj[key] = null;
    }
    return obj;
  }
  return { status: 'processed' };
}
