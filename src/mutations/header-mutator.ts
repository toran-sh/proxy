/**
 * Header Mutator - Transform request/response headers
 *
 * Operations:
 * - add: Add header (only if not exists)
 * - set: Set header (overwrite if exists)
 * - remove: Remove header
 * - rename: Rename header key
 */

import type { HeaderMutation } from '../../../shared/src/types';
import type { RequestContext } from '../core/context-builder';
import { TemplateEngine, type TemplateContext } from './template-engine';
import { ConditionEvaluator, type ConditionContext } from './condition-evaluator';

export class HeaderMutator {
  /**
   * Apply header mutations to a Headers object
   * Returns new Headers object with mutations applied
   */
  static apply(
    headers: Headers,
    mutations: HeaderMutation[],
    context: MutationContext
  ): Headers {
    const newHeaders = new Headers(headers);

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
        case 'add':
          this.addHeader(newHeaders, mutation, context.templateContext);
          break;

        case 'set':
          this.setHeader(newHeaders, mutation, context.templateContext);
          break;

        case 'remove':
          this.removeHeader(newHeaders, mutation);
          break;

        case 'rename':
          this.renameHeader(newHeaders, mutation);
          break;
      }
    }

    return newHeaders;
  }

  /**
   * Apply header mutations to a plain object (for context headers)
   */
  static applyToObject(
    headers: Record<string, string>,
    mutations: HeaderMutation[],
    context: MutationContext
  ): Record<string, string> {
    const newHeaders = { ...headers };

    for (const mutation of mutations) {
      // Check condition
      if (mutation.condition) {
        const conditionContext: ConditionContext = {
          request: context.requestContext,
          response: context.response,
        };

        if (!ConditionEvaluator.evaluate(mutation.condition, conditionContext)) {
          continue;
        }
      }

      // Apply mutation
      switch (mutation.type) {
        case 'add':
          if (!newHeaders[mutation.key]) {
            const value = this.renderValue(mutation.value, context.templateContext);
            if (value) {
              newHeaders[mutation.key] = value;
            }
          }
          break;

        case 'set':
          const setValue = this.renderValue(mutation.value, context.templateContext);
          if (setValue) {
            newHeaders[mutation.key] = setValue;
          }
          break;

        case 'remove':
          delete newHeaders[mutation.key];
          break;

        case 'rename':
          if (mutation.newKey && newHeaders[mutation.key]) {
            newHeaders[mutation.newKey] = newHeaders[mutation.key];
            delete newHeaders[mutation.key];
          }
          break;
      }
    }

    return newHeaders;
  }

  /**
   * Add header (only if not exists)
   */
  private static addHeader(
    headers: Headers,
    mutation: HeaderMutation,
    templateContext: TemplateContext
  ): void {
    if (!headers.has(mutation.key)) {
      const value = this.renderValue(mutation.value, templateContext);
      if (value) {
        headers.set(mutation.key, value);
      }
    }
  }

  /**
   * Set header (overwrite if exists)
   */
  private static setHeader(
    headers: Headers,
    mutation: HeaderMutation,
    templateContext: TemplateContext
  ): void {
    const value = this.renderValue(mutation.value, templateContext);
    if (value) {
      headers.set(mutation.key, value);
    }
  }

  /**
   * Remove header
   */
  private static removeHeader(headers: Headers, mutation: HeaderMutation): void {
    headers.delete(mutation.key);
  }

  /**
   * Rename header
   */
  private static renameHeader(headers: Headers, mutation: HeaderMutation): void {
    if (!mutation.newKey) {
      return;
    }

    const value = headers.get(mutation.key);
    if (value) {
      headers.set(mutation.newKey, value);
      headers.delete(mutation.key);
    }
  }

  /**
   * Render header value with template substitution
   */
  private static renderValue(
    value: string | undefined,
    templateContext: TemplateContext
  ): string | null {
    if (!value) {
      return null;
    }

    return TemplateEngine.render(value, templateContext);
  }
}

/**
 * Context for mutations
 */
export interface MutationContext {
  requestContext: RequestContext;
  templateContext: TemplateContext;
  response?: {
    status: number;
    headers: Record<string, string>;
  };
}
