import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  apiErrorMessage,
  classifyAuthErrorStatus,
  createApiErrorResponse,
  createClassifiedAuthErrorResponse,
  isAuthHttpStatus,
} from '../api/contracts';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.4.2 auth/error response contract parity', () => {
  it('always exposes a string error message while preserving optional metadata', () => {
    expect(apiErrorMessage(new Error('boom'))).toBe('boom');
    expect(apiErrorMessage({ message: 'object message' })).toBe('object message');

    expect(createApiErrorResponse(new Error('failed'))).toEqual({
      error: 'failed',
    });

    expect(createApiErrorResponse('upstream failed', {
      retryable: true,
      isAuthError: false,
      details: { code: 'UPSTREAM' },
      authSource: 'oauth_bearer',
    })).toEqual({
      error: 'upstream failed',
      retryable: true,
      isAuthError: false,
      details: { code: 'UPSTREAM' },
      authSource: 'oauth_bearer',
    });
  });

  it('classifies authentication failures narrowly instead of treating arbitrary invalid data as auth', () => {
    expect(classifyAuthErrorStatus(new Error('Missing Supabase access token.'))).toBe(401);
    expect(classifyAuthErrorStatus(new Error('Invalid Supabase access token.'))).toBe(401);
    expect(classifyAuthErrorStatus(new Error('Google OAuth bearer token is required.'))).toBe(401);
    expect(classifyAuthErrorStatus(new Error('No valid Google Sheets credentials found.'))).toBe(401);

    expect(classifyAuthErrorStatus(new Error('Invalid transaction tx-1: ticker is required.'))).toBe(500);
    expect(classifyAuthErrorStatus(new Error('database unavailable'))).toBe(500);

    expect(isAuthHttpStatus(401)).toBe(true);
    expect(isAuthHttpStatus(403)).toBe(true);
    expect(isAuthHttpStatus(400)).toBe(false);
    expect(isAuthHttpStatus(500)).toBe(false);
  });

  it('returns a canonical auth error body and status together', () => {
    expect(createClassifiedAuthErrorResponse(new Error('Missing Supabase access token.'))).toEqual({
      status: 401,
      body: {
        error: 'Missing Supabase access token.',
        isAuthError: true,
      },
    });

    expect(createClassifiedAuthErrorResponse(new Error('database unavailable'))).toEqual({
      status: 500,
      body: {
        error: 'database unavailable',
        isAuthError: false,
      },
    });
  });

  it('separates Supabase auth verification failures from authenticated handler failures in both runtimes', () => {
    for (const runtime of [read('worker.ts'), read('server.ts')]) {
      const authIndex = runtime.indexOf('verifySupabaseBearerToken');
      const authCatchIndex = runtime.indexOf('createClassifiedAuthErrorResponse(error)', authIndex);
      const handlerIndex = runtime.indexOf('handler(uid)', authCatchIndex);
      const handlerErrorIndex = runtime.indexOf(
        "createApiErrorResponse(error, { isAuthError: false })",
        handlerIndex,
      );

      expect(authIndex).toBeGreaterThan(-1);
      expect(authCatchIndex).toBeGreaterThan(authIndex);
      expect(handlerIndex).toBeGreaterThan(authCatchIndex);
      expect(handlerErrorIndex).toBeGreaterThan(handlerIndex);
    }
  });

  it('uses the canonical error builder for method, proxy, and Sheets error responses', () => {
    const worker = read('worker.ts');
    const server = read('server.ts');
    const sheetsServer = read('src/services/googleSheetsServer.ts');

    expect(worker).toContain('createApiErrorResponse');
    expect(server).toContain('createApiErrorResponse');
    expect(sheetsServer).toContain('createApiErrorResponse');
    expect(sheetsServer).toContain('sendGoogleUpstreamError');
    expect(sheetsServer).toContain('isAuthHttpStatus(status)');

    expect(worker).not.toContain('json({ error: data');
    expect(worker).toContain('details: data');
    expect(worker).toContain('authSource: "oauth_bearer"');
  });

  it('keeps missing Sheets credentials auth-classified in both runtimes', () => {
    const worker = read('worker.ts');
    const sheetsServer = read('src/services/googleSheetsServer.ts');

    expect(worker).toContain('createClassifiedAuthErrorResponse(error)');
    expect(sheetsServer).toContain('classifyAuthErrorStatus(normalized)');
    expect(sheetsServer).toContain('isAuthError: status === 401');
    expect(sheetsServer).toContain('authSource');
  });
});
