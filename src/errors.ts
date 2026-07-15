/**
 * A SeoFleetError always carries the process exit code it should map to, so
 * the CLI layer never has to re-derive "was this a usage error or a check
 * failure" from a generic Error message string.
 */
export class SeoFleetError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode = 2) {
    super(message);
    this.name = "SeoFleetError";
    this.exitCode = exitCode;
  }
}
