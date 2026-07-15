export class NoTextLayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoTextLayerError";
  }
}

/**
 * Thrown when an AI provider's response still fails analysis schema
 * validation after the repair retry. `issues` contains only Zod issue paths
 * and messages — never contract text.
 */
export class ProviderSchemaError extends Error {
  constructor(provider: string, public readonly issues: string) {
    super(`${provider} response failed Clausly analysis schema validation: ${issues}`);
    this.name = "ProviderSchemaError";
  }
}
