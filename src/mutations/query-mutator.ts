/**
 * Query Parameter Mutator - Transform URL query parameters
 *
 * Operations:
 * - add: Add parameter (only if not exists)
 * - set: Set parameter (overwrite if exists)
 * - remove: Remove parameter
 * - rename: Rename parameter key
 */

import type { QueryParamMutation } from '../../../shared/src/types';
import { TemplateEngine, type TemplateContext } from './template-engine';
import { ConditionEvaluator, type ConditionContext } from './condition-evaluator';
import type { MutationContext } from './header-mutator';

export class QueryMutator {
  /**
   * Apply query parameter mutations
   * Returns new query params object with mutations applied
   */
  static apply(
    queryParams: Record<string, string>,
    mutations: QueryParamMutation[],
    context: MutationContext
  ): Record<string, string> {
    const newParams = { ...queryParams };

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
          if (!newParams[mutation.key]) {
            const value = this.renderValue(mutation.value, context.templateContext);
            if (value) {
              newParams[mutation.key] = value;
            }
          }
          break;

        case 'set':
          const setValue = this.renderValue(mutation.value, context.templateContext);
          if (setValue) {
            newParams[mutation.key] = setValue;
          }
          break;

        case 'remove':
          delete newParams[mutation.key];
          break;

        case 'rename':
          if (mutation.newKey && newParams[mutation.key]) {
            newParams[mutation.newKey] = newParams[mutation.key];
            delete newParams[mutation.key];
          }
          break;
      }
    }

    return newParams;
  }

  /**
   * Build URL with mutated query parameters
   */
  static buildUrl(baseUrl: string, queryParams: Record<string, string>): string {
    const url = new URL(baseUrl);

    // Clear existing query params
    url.search = '';

    // Add mutated params
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /**
   * Render parameter value with template substitution
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
