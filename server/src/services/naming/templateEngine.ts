export type NamingTokens = Record<string, string | number | undefined>;

/** Replaces {token} placeholders in a naming template with values from `tokens`. Unknown or
 * missing tokens are replaced with an empty string rather than left as literal "{token}". */
export function renderTemplate(template: string, tokens: NamingTokens): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = tokens[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function pad2(n: number | undefined): string | undefined {
  return n === undefined ? undefined : String(n).padStart(2, "0");
}
