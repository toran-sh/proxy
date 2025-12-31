/**
 * Template Engine - Variable substitution for mutations
 *
 * Supports template syntax: ${variable.path.here}
 *
 * Available variables:
 * - ${params.id} - Path parameters
 * - ${variables.API_KEY} - Gateway variables
 * - ${request.headers.content-type} - Request headers
 * - ${request.query.userId} - Query parameters
 * - ${body.user.name} - Request/response body fields (JSON)
 * - ${env.ENVIRONMENT} - Environment variables
 */

import type { RequestContext } from '../core/context-builder';

export class TemplateEngine {
  /**
   * Render a template string with variable substitution
   *
   * Example:
   *   render("Hello ${body.name}", { body: { name: "John" } })
   *   => "Hello John"
   */
  static render(template: string, context: TemplateContext): string {
    // Match all ${...} patterns
    const pattern = /\$\{([^}]+)\}/g;

    return template.replace(pattern, (match, path) => {
      const value = this.resolvePath(path.trim(), context);
      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  /**
   * Resolve a dot-notation path to a value
   *
   * Example:
   *   resolvePath("body.user.name", { body: { user: { name: "John" } } })
   *   => "John"
   */
  private static resolvePath(path: string, context: TemplateContext): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array indices: users[0].name
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = current[key]?.[parseInt(index, 10)];
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Check if a template has variables
   */
  static hasVariables(template: string): boolean {
    return /\$\{[^}]+\}/.test(template);
  }

  /**
   * Extract all variable paths from a template
   *
   * Example:
   *   extractVariables("Hello ${body.name}, you are ${body.age} years old")
   *   => ["body.name", "body.age"]
   */
  static extractVariables(template: string): string[] {
    const pattern = /\$\{([^}]+)\}/g;
    const variables: string[] = [];
    let match;

    while ((match = pattern.exec(template)) !== null) {
      variables.push(match[1].trim());
    }

    return variables;
  }
}

/**
 * Template context - all data available for substitution
 */
export interface TemplateContext {
  // Path parameters
  params?: Record<string, string>;

  // Gateway variables
  variables?: Record<string, string>;

  // Request context
  request?: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
  };

  // Request/response body (parsed JSON)
  body?: any;

  // Environment
  env?: {
    ENVIRONMENT?: string;
  };

  // Custom context data
  [key: string]: any;
}

/**
 * Build template context from request context
 */
export function buildTemplateContext(
  requestContext: RequestContext,
  body?: any
): TemplateContext {
  return {
    params: requestContext.params,
    variables: requestContext.gateway.variables,
    request: {
      method: requestContext.request.method,
      path: requestContext.request.path,
      headers: requestContext.request.headers,
      query: requestContext.request.query,
    },
    body,
    env: requestContext.env,
  };
}
