import { InputParameterDef } from '../providers/types';

export type ConnectorStatus = 'active' | 'disabled';
export type AuthType = 'none' | 'api_key' | 'bearer_token';
export type ParameterType = 'text' | 'number' | 'boolean' | 'image' | 'file' | 'json';

export interface ConnectorInputParameter extends InputParameterDef {
  id?: string;
  connectorId?: string;
  position?: number;
}

export interface Connector {
  id: string;
  name: string;
  slug: string;
  description: string;
  provider: string;
  model: string;
  systemPrompt: string;
  status: ConnectorStatus;
  authType: AuthType;
  outputSchema: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  inputParameters: ConnectorInputParameter[];
}

export interface CreateConnectorDTO {
  name: string;
  slug?: string;
  description?: string;
  provider: string;
  model: string;
  systemPrompt: string;
  status?: ConnectorStatus;
  authType?: AuthType;
  outputSchema: Record<string, any>;
  inputParameters: Array<{
    name: string;
    type: ParameterType;
    required: boolean;
    description?: string;
    defaultValue?: string;
    validationRules?: Record<string, any>;
  }>;
}

export interface UpdateConnectorDTO extends Partial<CreateConnectorDTO> {}
