export class NoTextLayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoTextLayerError";
  }
}
