/**
 * Error handling utilities for toran.dev accelerator & debugger
 */

import type { ErrorResponse } from '../../shared/types';

export enum ErrorCode {
  SUBDOMAIN_NOT_FOUND = 'SUBDOMAIN_NOT_FOUND',
  MAPPING_INACTIVE = 'MAPPING_INACTIVE',
  DESTINATION_ERROR = 'DESTINATION_ERROR',
  INVALID_SUBDOMAIN = 'INVALID_SUBDOMAIN',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  request: Request
): Response {
  const acceptsHtml = request.headers.get('accept')?.includes('text/html');

  const errorResponse: ErrorResponse = {
    error: {
      message,
      code,
    },
    timestamp: new Date().toISOString(),
  };

  if (acceptsHtml) {
    return new Response(createErrorHTML(code, message, status), {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Toran-Error': code,
      },
    });
  }

  return new Response(JSON.stringify(errorResponse, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'X-Toran-Error': code,
    },
  });
}

/**
 * Handle subdomain not found error
 */
export function handleSubdomainNotFound(subdomain: string, request: Request): Response {
  return createErrorResponse(
    ErrorCode.SUBDOMAIN_NOT_FOUND,
    `Subdomain '${subdomain}' is not configured. Please check your mapping.`,
    404,
    request
  );
}

/**
 * Handle inactive mapping error
 */
export function handleMappingInactive(subdomain: string, request: Request): Response {
  return createErrorResponse(
    ErrorCode.MAPPING_INACTIVE,
    `Subdomain '${subdomain}' is currently inactive. Please try again later.`,
    503,
    request
  );
}

/**
 * Handle destination error
 */
export function handleDestinationError(error: Error, request: Request): Response {
  const isTimeout = error.message.includes('timeout') || error.name === 'TimeoutError';

  if (isTimeout) {
    return createErrorResponse(
      ErrorCode.TIMEOUT_ERROR,
      'The destination server took too long to respond.',
      504,
      request
    );
  }

  return createErrorResponse(
    ErrorCode.DESTINATION_ERROR,
    'Unable to reach the destination server. Please try again later.',
    502,
    request
  );
}

/**
 * Handle invalid subdomain
 */
export function handleInvalidSubdomain(hostname: string, request: Request): Response {
  return createErrorResponse(
    ErrorCode.INVALID_SUBDOMAIN,
    `Invalid hostname '${hostname}'. Expected format: subdomain.toran.dev`,
    400,
    request
  );
}

/**
 * Handle configuration error
 */
export function handleConfigurationError(message: string, request: Request): Response {
  return createErrorResponse(
    ErrorCode.CONFIGURATION_ERROR,
    `Configuration error: ${message}`,
    500,
    request
  );
}

/**
 * Handle internal error
 */
export function handleInternalError(error: Error, request: Request): Response {
  console.error('Internal error:', error);

  return createErrorResponse(
    ErrorCode.INTERNAL_ERROR,
    'An internal error occurred. Please try again later.',
    500,
    request
  );
}

/**
 * Create HTML error page
 */
function createErrorHTML(code: string, message: string, status: number): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Error ${status} - toran.dev Accelerator & Debugger</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      padding: 48px;
      max-width: 600px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }
    .status {
      font-size: 72px;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 16px;
    }
    .code {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 24px;
    }
    .message {
      font-size: 18px;
      color: #333;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .footer {
      font-size: 14px;
      color: #999;
      text-align: center;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="status">${status}</div>
    <div class="code">${code}</div>
    <div class="message">${escapeHtml(message)}</div>
    <div class="footer">
      Powered by <a href="https://www.toran.dev">toran.dev Accelerator & Debugger</a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
