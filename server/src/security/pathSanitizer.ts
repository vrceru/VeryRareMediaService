import { resolve, relative, isAbsolute, sep } from "node:path";

export class PathTraversalError extends Error {
  constructor(candidatePath: string, root: string) {
    super(`Path "${candidatePath}" escapes allowed root "${root}"`);
    this.name = "PathTraversalError";
  }
}

/**
 * Resolves `candidatePath` against `root` and throws PathTraversalError unless the result stays
 * inside `root`. Every filesystem write/move/delete driven by user- or provider-supplied names
 * (job titles, release filenames, config-relative paths) must go through this first.
 */
export function resolveWithinRoot(root: string, candidatePath: string): string {
  const resolvedRoot = resolve(root);
  const resolvedTarget = isAbsolute(candidatePath)
    ? resolve(candidatePath)
    : resolve(resolvedRoot, candidatePath);

  const rel = relative(resolvedRoot, resolvedTarget);
  if (rel === "" || rel === ".") return resolvedTarget;
  if (rel.startsWith("..") || isAbsolute(rel) || rel.split(sep)[0] === "..") {
    throw new PathTraversalError(candidatePath, resolvedRoot);
  }
  return resolvedTarget;
}
