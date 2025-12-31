/**
 * Mutation Engine - Orchestrates all request/response mutations
 *
 * Coordinates:
 * - Pre-request mutations (headers, query params, body)
 * - Post-response mutations (headers, body, status)
 */

import type { PreMutations, PostMutations, FlattenedRoute } from '../../../shared/src/types';
import type { RequestContext } from '../core/context-builder';
import { HeaderMutator, type MutationContext } from './header-mutator';
import { QueryMutator } from './query-mutator';
import { BodyMutator } from './body-mutator';
import { buildTemplateContext } from './template-engine';

export interface MutatedRequest {
  url: string;
  method: string;
  headers: Headers;
  body: string | null;
  mutationsApplied: number;
}

export interface MutatedResponse {
  response: Response;
  mutationsApplied: number;
}

export class MutationEngine {
  /**
   * Apply pre-request mutations
   *
   * Transforms the request before proxying:
   * - Headers (add, set, remove, rename)
   * - Query parameters
   * - Body
   */
  static async applyPreMutations(
    request: Request,
    route: FlattenedRoute,
    context: RequestContext
  ): Promise<MutatedRequest> {
    const mutations = route.preMutations || {};
    let mutationsCount = 0;

    // Extract current request data
    const url = new URL(request.url);
    let headers = new Headers(request.headers);
    let queryParams = { ...context.request.query };
    let body: string | null = context.request.body;

    // Build template context
    const templateContext = buildTemplateContext(context, body ? JSON.parse(body) : null);

    // Build mutation context
    const mutationContext: MutationContext = {
      requestContext: context,
      templateContext,
    };

    // 1. Apply header mutations
    if (mutations.headers && mutations.headers.length > 0) {
      headers = HeaderMutator.apply(headers, mutations.headers, mutationContext);
      mutationsCount += mutations.headers.length;
    }

    // 2. Apply query parameter mutations
    if (mutations.queryParams && mutations.queryParams.length > 0) {
      queryParams = QueryMutator.apply(queryParams, mutations.queryParams, mutationContext);
      mutationsCount += mutations.queryParams.length;
    }

    // 3. Apply body mutations
    if (mutations.body && mutations.body.length > 0 && body) {
      body = await BodyMutator.apply(body, mutations.body, mutationContext);
      mutationsCount += mutations.body.length;
    }

    // Rebuild URL with mutated query params
    const mutatedUrl = QueryMutator.buildUrl(url.origin + url.pathname, queryParams);

    return {
      url: mutatedUrl,
      method: request.method,
      headers,
      body,
      mutationsApplied: mutationsCount,
    };
  }

  /**
   * Apply post-response mutations
   *
   * Transforms the response after proxying:
   * - Headers (add, set, remove, rename)
   * - Body
   * - Status code
   */
  static async applyPostMutations(
    response: Response,
    route: FlattenedRoute,
    context: RequestContext
  ): Promise<MutatedResponse> {
    const mutations = route.postMutations || {};
    let mutationsCount = 0;

    // Clone response to avoid consuming body
    const clonedResponse = response.clone();

    // Extract current response data
    let headers = new Headers(clonedResponse.headers);
    let body = await clonedResponse.text();
    let status = clonedResponse.status;
    let statusText = clonedResponse.statusText;

    // Build template context with response body
    let bodyData;
    try {
      bodyData = JSON.parse(body);
    } catch {
      bodyData = body;
    }
    const templateContext = buildTemplateContext(context, bodyData);

    // Build mutation context with response info
    const responseContext = {
      status: clonedResponse.status,
      headers: this.headersToObject(clonedResponse.headers),
    };

    const mutationContext: MutationContext = {
      requestContext: context,
      templateContext,
      response: responseContext,
    };

    // 1. Apply header mutations
    if (mutations.headers && mutations.headers.length > 0) {
      headers = HeaderMutator.apply(headers, mutations.headers, mutationContext);
      mutationsCount += mutations.headers.length;
    }

    // 2. Apply body mutations
    if (mutations.body && mutations.body.length > 0) {
      body = await BodyMutator.apply(body, mutations.body, mutationContext);
      mutationsCount += mutations.body.length;
    }

    // 3. Apply status mutations
    if (mutations.status) {
      const originalStatus = status;
      status = this.applyStatusMutation(status, mutations.status);
      if (status !== originalStatus) {
        mutationsCount += 1;
        // Update status text based on new status
        statusText = this.getStatusText(status);
      }
    }

    // Create new response with mutations
    const mutatedResponse = new Response(body, {
      status,
      statusText,
      headers,
    });

    return {
      response: mutatedResponse,
      mutationsApplied: mutationsCount,
    };
  }

  /**
   * Apply status code mutation
   */
  private static applyStatusMutation(
    originalStatus: number,
    mutation: { type: 'override' | 'map'; override?: number; map?: Record<string, number> }
  ): number {
    switch (mutation.type) {
      case 'override':
        return mutation.override || originalStatus;

      case 'map':
        if (mutation.map) {
          const mapped = mutation.map[originalStatus.toString()];
          return mapped !== undefined ? mapped : originalStatus;
        }
        return originalStatus;

      default:
        return originalStatus;
    }
  }

  /**
   * Convert Headers to plain object
   */
  private static headersToObject(headers: Headers): Record<string, string> {
    const obj: Record<string, string> = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Get standard status text for status code
   */
  private static getStatusText(status: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      301: 'Moved Permanently',
      302: 'Found',
      304: 'Not Modified',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };

    return statusTexts[status] || 'Unknown';
  }
}
