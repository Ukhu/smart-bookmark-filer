export function findConventionViolations(
  relativePaths: readonly string[],
): string[];

export function checkConventions(rootDirectory: string): Promise<string[]>;
