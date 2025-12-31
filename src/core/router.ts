/**
 * Router - Matches incoming requests to routes
 *
 * Features:
 * - Priority-based routing (higher priority evaluated first)
 * - Path parameter extraction (/users/:id)
 * - Wildcard support (/api/*)
 * - Method matching (GET, POST, or *)
 */

import type { FlattenedRoute } from '../../../shared/src/types';

export interface RouteMatch {
  route: FlattenedRoute;
  pathParams: Record<string, string>;
}

export class Router {
  /**
   * Match request to a route
   *
   * Routes are already sorted by priority in FlattenedGateway.
   * Returns first matching route or null if no match.
   */
  static match(
    path: string,
    method: string,
    routes: FlattenedRoute[]
  ): RouteMatch | null {
    for (const route of routes) {
      // Check method match
      if (!this.matchMethod(method, route.method)) {
        continue;
      }

      // Check path match and extract params
      const pathParams = this.matchPath(path, route.pathRegex);
      if (pathParams === null) {
        continue;
      }

      // Match found!
      return {
        route,
        pathParams,
      };
    }

    return null;
  }

  /**
   * Check if request method matches route methods
   */
  private static matchMethod(requestMethod: string, routeMethods: string[]): boolean {
    // Wildcard matches all methods
    if (routeMethods.includes('*')) {
      return true;
    }

    // Check for exact method match (case-insensitive)
    return routeMethods.some(
      (m) => m.toUpperCase() === requestMethod.toUpperCase()
    );
  }

  /**
   * Match path against compiled regex and extract parameters
   *
   * Returns path parameters as key-value map, or null if no match.
   */
  private static matchPath(
    path: string,
    pathRegex: string
  ): Record<string, string> | null {
    const regex = new RegExp(pathRegex);
    const match = path.match(regex);

    if (!match) {
      return null;
    }

    // Extract captured groups as parameters
    // For now, we use numeric keys (param0, param1, etc.)
    // TODO: Extract actual parameter names from original path pattern
    const params: Record<string, string> = {};
    for (let i = 1; i < match.length; i++) {
      params[`param${i - 1}`] = match[i];
    }

    return params;
  }

  /**
   * Extract parameter names from path pattern
   *
   * Example: "/users/:id/posts/:postId" → ["id", "postId"]
   */
  static extractParamNames(path: string): string[] {
    const paramPattern = /:([a-zA-Z0-9_]+)/g;
    const names: string[] = [];
    let match;

    while ((match = paramPattern.exec(path)) !== null) {
      names.push(match[1]);
    }

    return names;
  }

  /**
   * Build path params with proper names
   *
   * Combines extracted values with parameter names from route definition.
   */
  static buildNamedParams(
    path: string,
    pathRegex: string,
    routePath: string
  ): Record<string, string> | null {
    const regex = new RegExp(pathRegex);
    const match = path.match(regex);

    if (!match) {
      return null;
    }

    // Get parameter names from route path
    const paramNames = this.extractParamNames(routePath);

    // Build named params map
    const params: Record<string, string> = {};
    for (let i = 0; i < paramNames.length && i + 1 < match.length; i++) {
      params[paramNames[i]] = match[i + 1];
    }

    // If there are more captured groups than named params (e.g., wildcards),
    // add them with numeric keys
    for (let i = paramNames.length; i + 1 < match.length; i++) {
      params[`wildcard${i - paramNames.length}`] = match[i + 1];
    }

    return params;
  }
}
