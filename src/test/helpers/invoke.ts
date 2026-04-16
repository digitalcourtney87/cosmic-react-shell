/**
 * Test helper: spy on `FunctionsClient.prototype.invoke` so test mocks survive
 * the `supabase.functions` getter (which returns a fresh FunctionsClient each
 * access). Returns a vitest spy you can chain `mockResolvedValue(Once)` calls on.
 */
import { vi, type MockInstance } from 'vitest';
import { FunctionsClient } from '@supabase/functions-js';

export type InvokeResult = { data: unknown; error: unknown };

export function spyInvoke(): MockInstance {
  return vi.spyOn(FunctionsClient.prototype as unknown as { invoke: () => Promise<InvokeResult> }, 'invoke');
}

export function invokeOk(text: string): Promise<InvokeResult> {
  return Promise.resolve({ data: { text }, error: null });
}

export function invokeReason(reason: string, message = reason): Promise<InvokeResult> {
  return Promise.resolve({ data: { error: message, reason }, error: null });
}

export function invokeNetworkError(message = 'offline'): Promise<InvokeResult> {
  return Promise.resolve({ data: null, error: new Error(message) });
}
