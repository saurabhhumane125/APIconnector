import { InputParameterDef } from './types';

export interface FormattedPrompt {
  systemPrompt: string;
  userPromptText: string;
  images: Array<{
    paramName: string;
    urlOrBase64: string;
    mimeType?: string;
  }>;
}

export function buildExecutionPrompt(
  systemPrompt: string,
  inputs: Record<string, any>,
  inputDefinitions: InputParameterDef[],
  outputSchema?: Record<string, any>
): FormattedPrompt {
  const images: Array<{ paramName: string; urlOrBase64: string; mimeType?: string }> = [];
  const textParts: string[] = [];

  // Group and format inputs based on parameter definitions
  for (const def of inputDefinitions) {
    const value = inputs[def.name];
    if (value === undefined || value === null) {
      continue;
    }

    if (def.type === 'image') {
      const imgStr = String(value);
      let mimeType = 'image/jpeg';
      if (imgStr.startsWith('data:image/png')) mimeType = 'image/png';
      else if (imgStr.startsWith('data:image/webp')) mimeType = 'image/webp';
      else if (imgStr.startsWith('data:image/gif')) mimeType = 'image/gif';

      images.push({
        paramName: def.name,
        urlOrBase64: imgStr,
        mimeType,
      });
      textParts.push(`[Input '${def.name}' (image): attached visually]`);
    } else if (def.type === 'json' || typeof value === 'object') {
      textParts.push(`[Input '${def.name}' (${def.type})]:\n${JSON.stringify(value, null, 2)}`);
    } else {
      textParts.push(`[Input '${def.name}' (${def.type})]: ${value}`);
    }
  }

  // Also catch any extra inputs provided that weren't in inputDefinitions
  const definedNames = new Set(inputDefinitions.map(d => d.name));
  for (const [key, val] of Object.entries(inputs)) {
    if (!definedNames.has(key) && val !== undefined && val !== null) {
      textParts.push(`[Input '${key}']: ${typeof val === 'object' ? JSON.stringify(val, null, 2) : val}`);
    }
  }

  let fullSystemPrompt = systemPrompt.trim();
  if (outputSchema) {
    fullSystemPrompt += `\n\nOUTPUT FORMAT SPECIFICATION:\nYou must respond ONLY with a valid JSON object matching this schema. Do not enclose in markdown ticks if possible, and include no other conversational text.\nSchema:\n${JSON.stringify(outputSchema, null, 2)}`;
  }

  return {
    systemPrompt: fullSystemPrompt,
    userPromptText: textParts.join('\n\n'),
    images,
  };
}
