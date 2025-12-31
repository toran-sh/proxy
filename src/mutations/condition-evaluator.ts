/**
 * Condition Evaluator - Determines if mutations should be applied
 *
 * Supports conditions based on:
 * - Headers (presence, value, pattern)
 * - Query parameters
 * - Path
 * - Method
 * - Status code (for post-mutations)
 * - Custom expressions
 */

import type { MutationCondition } from '../../../shared/src/types';
import type { RequestContext } from '../core/context-builder';
import { TemplateEngine } from './template-engine';

export interface ConditionContext {
  request: RequestContext;
  response?: {
    status: number;
    headers: Record<string, string>;
  };
}

export class ConditionEvaluator {
  /**
   * Evaluate if a condition is met
   */
  static evaluate(condition: MutationCondition, context: ConditionContext): boolean {
    switch (condition.type) {
      case 'header':
        return this.evaluateHeader(condition, context);

      case 'query':
        return this.evaluateQuery(condition, context);

      case 'path':
        return this.evaluatePath(condition, context);

      case 'method':
        return this.evaluateMethod(condition, context);

      case 'status':
        return this.evaluateStatus(condition, context);

      case 'expression':
        return this.evaluateExpression(condition, context);

      default:
        console.warn(`Unknown condition type: ${condition.type}`);
        return false;
    }
  }

  /**
   * Evaluate header condition
   */
  private static evaluateHeader(
    condition: MutationCondition,
    context: ConditionContext
  ): boolean {
    const headerValue = context.request.request.headers[condition.key || ''];

    switch (condition.operator) {
      case 'exists':
        return headerValue !== undefined;

      case 'equals':
        return headerValue === condition.value;

      case 'contains':
        return headerValue?.includes(condition.value || '') || false;

      case 'matches':
        if (!condition.value) return false;
        const regex = new RegExp(condition.value);
        return regex.test(headerValue || '');

      default:
        return false;
    }
  }

  /**
   * Evaluate query parameter condition
   */
  private static evaluateQuery(
    condition: MutationCondition,
    context: ConditionContext
  ): boolean {
    const queryValue = context.request.request.query[condition.key || ''];

    switch (condition.operator) {
      case 'exists':
        return queryValue !== undefined;

      case 'equals':
        return queryValue === condition.value;

      case 'contains':
        return queryValue?.includes(condition.value || '') || false;

      case 'matches':
        if (!condition.value) return false;
        const regex = new RegExp(condition.value);
        return regex.test(queryValue || '');

      default:
        return false;
    }
  }

  /**
   * Evaluate path condition
   */
  private static evaluatePath(
    condition: MutationCondition,
    context: ConditionContext
  ): boolean {
    const path = context.request.request.path;

    switch (condition.operator) {
      case 'equals':
        return path === condition.value;

      case 'contains':
        return path.includes(condition.value || '');

      case 'matches':
        if (!condition.value) return false;
        const regex = new RegExp(condition.value);
        return regex.test(path);

      default:
        return false;
    }
  }

  /**
   * Evaluate method condition
   */
  private static evaluateMethod(
    condition: MutationCondition,
    context: ConditionContext
  ): boolean {
    const method = context.request.request.method;

    switch (condition.operator) {
      case 'equals':
        return method.toUpperCase() === condition.value?.toUpperCase();

      default:
        return false;
    }
  }

  /**
   * Evaluate status code condition (for post-mutations)
   */
  private static evaluateStatus(
    condition: MutationCondition,
    context: ConditionContext
  ): boolean {
    if (!context.response) {
      return false;
    }

    const status = context.response.status;
    const targetStatus = parseInt(condition.value || '0', 10);

    switch (condition.operator) {
      case 'equals':
        return status === targetStatus;

      case 'gt':
        return status > targetStatus;

      case 'lt':
        return status < targetStatus;

      default:
        return false;
    }
  }

  /**
   * Evaluate custom expression
   * Simple template-based evaluation for now
   * Example: "${request.headers.authorization}" (checks if truthy)
   */
  private static evaluateExpression(
    condition: MutationCondition,
    context: ConditionContext
  ): boolean {
    if (!condition.expression) {
      return false;
    }

    try {
      // Build template context
      const templateContext = {
        params: context.request.params,
        variables: context.request.gateway.variables,
        request: {
          method: context.request.request.method,
          path: context.request.request.path,
          headers: context.request.request.headers,
          query: context.request.request.query,
        },
        response: context.response,
      };

      // Render expression as template
      const result = TemplateEngine.render(condition.expression, templateContext);

      // Check if result is truthy
      return !!result && result !== 'undefined' && result !== 'null';
    } catch (error) {
      console.error('Failed to evaluate expression:', error);
      return false;
    }
  }
}
