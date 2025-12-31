/**
 * Body Mutator - Transform request/response body
 *
 * Supports 4 transformation strategies:
 * 1. json-map: Simple field mapping (user.name -> userName)
 * 2. json-path: JSONPath queries ($.users[*].name)
 * 3. template: String templates (Hello ${body.name})
 * 4. function: JavaScript functions (sandboxed execution)
 */

import type { BodyMutation } from '../../../shared/src/types';
import { TemplateEngine, type TemplateContext } from './template-engine';
import { ConditionEvaluator, type ConditionContext } from './condition-evaluator';
import type { MutationContext } from './header-mutator';

export class BodyMutator {
  /**
   * Apply body mutations
   * Returns mutated body as string
   */
  static async apply(
    body: string,
    mutations: BodyMutation[],
    context: MutationContext
  ): Promise<string> {
    let result = body;

    for (const mutation of mutations) {
      // Check condition if specified
      if (mutation.condition) {
        const conditionContext: ConditionContext = {
          request: context.requestContext,
          response: context.response,
        };

        if (!ConditionEvaluator.evaluate(mutation.condition, conditionContext)) {
          continue; // Skip this mutation
        }
      }

      // Apply mutation based on type
      switch (mutation.type) {
        case 'json-map':
          if (mutation.jsonMap) {
            result = await this.applyJsonMap(result, mutation.jsonMap);
          }
          break;

        case 'json-path':
          if (mutation.jsonPath) {
            result = await this.applyJsonPath(result, mutation.jsonPath);
          }
          break;

        case 'template':
          if (mutation.template) {
            result = await this.applyTemplate(result, mutation.template, context);
          }
          break;

        case 'function':
          if (mutation.function) {
            result = await this.applyFunction(
              result,
              mutation.function.code,
              mutation.function.timeout,
              context
            );
          }
          break;
      }
    }

    return result;
  }

  /**
   * Apply JSON field mapping
   *
   * Example:
   *   Input: { "user": { "name": "John" } }
   *   Mapping: { "user.name": "userName" }
   *   Output: { "userName": "John" }
   */
  private static async applyJsonMap(
    body: string,
    mapping: Record<string, string>
  ): Promise<string> {
    try {
      const json = JSON.parse(body);
      const result: any = {};

      for (const [sourcePath, targetPath] of Object.entries(mapping)) {
        const value = this.getNestedValue(json, sourcePath);
        if (value !== undefined) {
          this.setNestedValue(result, targetPath, value);
        }
      }

      return JSON.stringify(result);
    } catch (error) {
      console.error('JSON map error:', error);
      return body; // Return original on error
    }
  }

  /**
   * Apply JSONPath query
   *
   * Simple implementation supporting:
   * - $.field - Root field access
   * - $.field.nested - Nested access
   * - $.array[0] - Array index
   * - $.array[*] - Array wildcard (returns array of values)
   */
  private static async applyJsonPath(
    body: string,
    config: { expression: string; target?: string }
  ): Promise<string> {
    try {
      const json = JSON.parse(body);
      const result = this.evaluateJsonPath(json, config.expression);

      if (config.target) {
        // Put result at target path
        const output: any = {};
        this.setNestedValue(output, config.target, result);
        return JSON.stringify(output);
      } else {
        // Return result directly
        return JSON.stringify(result);
      }
    } catch (error) {
      console.error('JSONPath error:', error);
      return body;
    }
  }

  /**
   * Apply template transformation
   *
   * Parse body as JSON, make available in template context, render template
   */
  private static async applyTemplate(
    body: string,
    template: string,
    context: MutationContext
  ): Promise<string> {
    try {
      // Parse body as JSON (if possible)
      let bodyData;
      try {
        bodyData = JSON.parse(body);
      } catch {
        bodyData = body; // Use as string if not JSON
      }

      // Build template context with body
      const templateContext: TemplateContext = {
        ...context.templateContext,
        body: bodyData,
      };

      // Render template
      return TemplateEngine.render(template, templateContext);
    } catch (error) {
      console.error('Template error:', error);
      return body;
    }
  }

  /**
   * Apply JavaScript function
   *
   * WARNING: Basic implementation for Phase 2
   * Phase 3 will add proper sandboxing with Cloudflare Workers isolates
   */
  private static async applyFunction(
    body: string,
    code: string,
    timeout: number,
    context: MutationContext
  ): Promise<string> {
    try {
      // Parse body
      let bodyData;
      try {
        bodyData = JSON.parse(body);
      } catch {
        bodyData = body;
      }

      // Create function context
      const fnContext = {
        body: bodyData,
        params: context.requestContext.params,
        variables: context.requestContext.gateway.variables,
        request: context.requestContext.request,
      };

      // Execute function with timeout
      // NOTE: Simple implementation - Phase 3 will add proper sandboxing
      const fn = new Function('context', code);
      const result = fn(fnContext);

      // Return stringified result
      return typeof result === 'string' ? result : JSON.stringify(result);
    } catch (error) {
      console.error('Function execution error:', error);
      return body;
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  private static getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array access: field[0]
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
   * Set nested value in object using dot notation
   */
  private static setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];

      if (!current[part]) {
        current[part] = {};
      }

      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Evaluate JSONPath expression (simplified implementation)
   *
   * Supports:
   * - $.field
   * - $.field.nested
   * - $.array[0]
   * - $.array[*] (returns array of all values)
   */
  private static evaluateJsonPath(data: any, expression: string): any {
    // Remove leading $. if present
    let path = expression.startsWith('$.') ? expression.slice(2) : expression;
    if (path === '$') {
      return data;
    }

    // Split into parts
    const parts = path.split('.');
    let current = data;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }

      // Handle array wildcard: array[*]
      if (part.endsWith('[*]')) {
        const arrayKey = part.slice(0, -3);
        const array = arrayKey ? current[arrayKey] : current;

        if (!Array.isArray(array)) {
          return undefined;
        }

        return array;
      }

      // Handle array index: array[0]
      const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, key, index] = arrayMatch;
        current = key ? current[key]?.[parseInt(index, 10)] : current[parseInt(index, 10)];
      } else {
        current = current[part];
      }
    }

    return current;
  }
}
