import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isRealSupabaseConfigured } from './client';
import {
  CUSTOMER_APP_TABLES,
  CUSTOMER_APP_TABLE_COUNT,
  type SalonOSTableName,
} from './tables';

/**
 * Nexora SalonOS Customer App — schema detection/mapping.
 *
 * This module detects the canonical customer-app tables on the live Supabase
 * project and returns a per-table report. It never creates, renames, drops, or
 * overwrites anything. It is purely read-only (PostgREST HEAD against each
 * public table).
 */

export interface TableSchemaReport {
  /** The full name this app resolved for the table. */
  name: SalonOSTableName;
  present: boolean;
  error?: string;
}

export interface SalonOSSchemaReport {
  configured: boolean;
  checked: boolean;
  total: number;
  detected: number;
  missing: SalonOSTableName[];
  tables: TableSchemaReport[];
  /** True when every tracked table was detected on the live project. */
  allPresent: boolean;
}

export async function checkTable(client: SupabaseClient, table: string) {
  try {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      // 42P01 / PGRST205 / "does not exist" => missing
      const message = error.message || '';
      const code = (error as { code?: string }).code || '';
      if (
        code === '42P01' ||
        code === 'PGRST205' ||
        message.includes('does not exist') ||
        message.includes('Could not find the table')
      ) {
        return { present: false, error: message };
      }
      // RLS/other errors still indicate the table exists.
      return { present: true, error: message };
    }
    return { present: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (
      message.includes('does not exist') ||
      message.includes('Could not find the table')
    ) {
      return { present: false, error: message };
    }
    return { present: false, error: message };
  }
}

export async function detectSalonOSSchema(
  client: SupabaseClient | null = supabase
): Promise<SalonOSSchemaReport> {
  if (!client || !isRealSupabaseConfigured) {
    return {
      configured: false,
      checked: false,
      total: CUSTOMER_APP_TABLE_COUNT,
      detected: 0,
      missing: [...CUSTOMER_APP_TABLES],
      tables: CUSTOMER_APP_TABLES.map((name) => ({ name, present: false, error: 'not configured' })),
      allPresent: false,
    };
  }

  // Only use live schema detection when a real Supabase project is configured.
  // The local demo client is intentionally not introspected — it never mirrors
  // the canonical dataset.
  const checks = await Promise.all(
    CUSTOMER_APP_TABLES.map(async (name) => {
      const result = await checkTable(client, name);
      return { name, ...result };
    })
  );

  const detected = checks.filter((entry) => entry.present).length;
  const missing = checks.filter((entry) => !entry.present).map((entry) => entry.name);
  return {
    configured: isRealSupabaseConfigured,
    checked: true,
    total: CUSTOMER_APP_TABLE_COUNT,
    detected,
    missing,
    tables: checks,
    allPresent: detected === CUSTOMER_APP_TABLE_COUNT,
  };
}

export function formatSchemaReport(report: SalonOSSchemaReport): string {
  if (!report.configured) {
    return 'Nexora Supabase is not configured. No customer tables were checked.';
  }
  return [
    `Supabase database ${report.detected}/${report.total} customer-app tables detected.`,
    ...report.tables.map((t) => `${t.present ? '✓' : '✗'} ${t.name}${t.error ? ` (${t.error})` : ''}`),
  ].join('\n');
}

export async function verifyCustomerTables(
  client: SupabaseClient | null = supabase
): Promise<SalonOSSchemaReport> {
  const report = await detectSalonOSSchema(client);
  return report;
}
