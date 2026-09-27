import { ConnectorService } from './connectorService';
import { ProviderRegistry } from '../providers/registry';
import { validateAndSanitizeInputs } from '../validation/inputValidator';
import { ApiKeyService } from '../auth/apiKeyService';
import { RequestLogger } from '../logging/requestLogger';
import { Connector } from './types';

export interface ExecutionOptions {
  authHeader?: string;
  apiKeyHeader?: string;
  clientIp?: string;
  apiKeyOverride?: string;
}

export interface ExecutionEnvelope<T = any> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: any;
  } | null;
  meta: {
    requestId: string;
    connectorId?: string;
    connectorSlug?: string;
    provider?: string;
    model?: string;
    durationMs: number;
    tokens?: {
      prompt: number;
      completion: number;
      total: number;
    };
    estimatedCost?: number;
  };
}

export class ExecutionEngine {
  private static instance: ExecutionEngine | null = null;

  public static getInstance(): ExecutionEngine {
    if (!ExecutionEngine.instance) {
      ExecutionEngine.instance = new ExecutionEngine();
    }
    return ExecutionEngine.instance;
  }

  public async execute(
    connectorIdentifier: string,
    rawInputs: Record<string, any>,
    options?: ExecutionOptions
  ): Promise<{ statusCode: number; envelope: ExecutionEnvelope }> {
    const startTime = Date.now();
    const requestId = `req_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
    const connectorService = ConnectorService.getInstance();
    const apiKeyService = ApiKeyService.getInstance();
    const logger = RequestLogger.getInstance();

    // 1. Resolve Connector by ID or Slug
    let connector: Connector | null = null;
    if (connectorIdentifier.startsWith('conn_')) {
      connector = connectorService.getConnectorById(connectorIdentifier);
    }
    if (!connector) {
      connector = connectorService.getConnectorBySlug(connectorIdentifier);
    }

    if (!connector) {
      const durationMs = Date.now() - startTime;
      return {
        statusCode: 404,
        envelope: {
          success: false,
          data: null,
          error: {
            code: 'CONNECTOR_NOT_FOUND',
            message: `Connector '${connectorIdentifier}' could not be found.`,
          },
          meta: { requestId, durationMs },
        },
      };
    }

    // 2. Connector Status Check (Disabled rejection before provider execution)
    if (connector.status === 'disabled') {
      const durationMs = Date.now() - startTime;
      logger.log({
        connectorId: connector.id,
        status: 'error',
        httpStatus: 403,
        durationMs,
        provider: connector.provider,
        model: connector.model,
        errorCode: 'CONNECTOR_DISABLED',
        errorMessage: 'Execution rejected: Connector is currently disabled by administrator.',
        inputPayload: rawInputs,
        clientIp: options?.clientIp,
      });

      return {
        statusCode: 403,
        envelope: {
          success: false,
          data: null,
          error: {
            code: 'CONNECTOR_DISABLED',
            message: 'This connector is currently disabled and not accepting requests.',
          },
          meta: {
            requestId,
            connectorId: connector.id,
            connectorSlug: connector.slug,
            durationMs,
          },
        },
      };
    }

    // 3. Authentication & Authorization Check
    if (connector.authType !== 'none') {
      let rawToken = '';
      if (options?.apiKeyHeader) {
        rawToken = options.apiKeyHeader;
      } else if (options?.authHeader) {
        const parts = options.authHeader.split(' ');
        rawToken = parts.length === 2 ? parts[1] : parts[0];
      }

      const verifyResult = apiKeyService.verifyKey(rawToken, connector.id);
      if (!verifyResult.valid) {
        const durationMs = Date.now() - startTime;
        logger.log({
          connectorId: connector.id,
          status: 'error',
          httpStatus: 401,
          durationMs,
          provider: connector.provider,
          model: connector.model,
          errorCode: 'UNAUTHORIZED',
          errorMessage: verifyResult.reason || 'Unauthorized access attempt',
          clientIp: options?.clientIp,
        });

        return {
          statusCode: 401,
          envelope: {
            success: false,
            data: null,
            error: {
              code: 'UNAUTHORIZED',
              message: verifyResult.reason || 'Authentication required.',
            },
            meta: {
              requestId,
              connectorId: connector.id,
              connectorSlug: connector.slug,
              durationMs,
            },
          },
        };
      }
    }

    // 4. Dynamic Input Parameter Validation & Type Coercion
    const validation = validateAndSanitizeInputs(rawInputs, connector.inputParameters);
    if (!validation.valid) {
      const durationMs = Date.now() - startTime;
      logger.log({
        connectorId: connector.id,
        status: 'error',
        httpStatus: 400,
        durationMs,
        provider: connector.provider,
        model: connector.model,
        errorCode: 'VALIDATION_FAILED',
        errorMessage: 'Incoming request inputs failed parameter schema validation.',
        inputPayload: rawInputs,
        responsePayload: validation.errors,
        clientIp: options?.clientIp,
      });

      return {
        statusCode: 400,
        envelope: {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Invalid request input parameters.',
            details: validation.errors,
          },
          meta: {
            requestId,
            connectorId: connector.id,
            connectorSlug: connector.slug,
            durationMs,
          },
        },
      };
    }

    // 5. Select Provider Adapter from Registry
    const registry = ProviderRegistry.getInstance();
    let adapter;
    try {
      adapter = registry.get(connector.provider);
    } catch {
      const durationMs = Date.now() - startTime;
      return {
        statusCode: 500,
        envelope: {
          success: false,
          data: null,
          error: {
            code: 'UNKNOWN_PROVIDER',
            message: `Provider '${connector.provider}' is not registered.`,
          },
          meta: {
            requestId,
            connectorId: connector.id,
            durationMs,
          },
        },
      };
    }

    // 6. Execute Provider through Adapter Contract
    try {
      const providerResult = await adapter.execute({
        model: connector.model,
        systemPrompt: connector.systemPrompt,
        inputs: validation.sanitizedInputs,
        inputDefinitions: connector.inputParameters,
        outputSchema: connector.outputSchema,
        apiKeyOverride: options?.apiKeyOverride,
      });

      const durationMs = Date.now() - startTime;

      // 7. Record Persistent Request Log
      logger.log({
        connectorId: connector.id,
        status: 'success',
        httpStatus: 200,
        durationMs,
        provider: connector.provider,
        model: connector.model,
        promptTokens: providerResult.tokens.promptTokens,
        completionTokens: providerResult.tokens.completionTokens,
        totalTokens: providerResult.tokens.totalTokens,
        estimatedCost: providerResult.estimatedCost,
        inputPayload: validation.sanitizedInputs,
        responsePayload: providerResult.data,
        clientIp: options?.clientIp,
      });

      // 8. Return Predictable Success Envelope
      return {
        statusCode: 200,
        envelope: {
          success: true,
          data: providerResult.data,
          error: null,
          meta: {
            requestId,
            connectorId: connector.id,
            connectorSlug: connector.slug,
            provider: connector.provider,
            model: connector.model,
            durationMs,
            tokens: {
              prompt: providerResult.tokens.promptTokens,
              completion: providerResult.tokens.completionTokens,
              total: providerResult.tokens.totalTokens,
            },
            estimatedCost: providerResult.estimatedCost,
          },
        },
      };
    } catch (providerError: any) {
      const durationMs = Date.now() - startTime;
      const errorMessage = providerError.message || 'An error occurred during AI provider execution.';

      logger.log({
        connectorId: connector.id,
        status: 'error',
        httpStatus: 502,
        durationMs,
        provider: connector.provider,
        model: connector.model,
        errorCode: 'PROVIDER_EXECUTION_ERROR',
        errorMessage,
        inputPayload: validation.sanitizedInputs,
        clientIp: options?.clientIp,
      });

      return {
        statusCode: 502,
        envelope: {
          success: false,
          data: null,
          error: {
            code: 'PROVIDER_EXECUTION_ERROR',
            message: errorMessage,
          },
          meta: {
            requestId,
            connectorId: connector.id,
            connectorSlug: connector.slug,
            provider: connector.provider,
            model: connector.model,
            durationMs,
          },
        },
      };
    }
  }
}
