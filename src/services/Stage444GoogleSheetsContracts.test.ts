import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTES,
  createSheetsAppendResponse,
  createSheetsBatchUpdateResponse,
  createSheetsDriveFilesResponse,
  createSheetsMetadataResponse,
  createSheetsValuesResponse,
  createSheetsWriteValuesResponse,
  parseSheetsAppendRequest,
  parseSheetsBatchUpdateRequest,
  parseSheetsMetadataQuery,
  parseSheetsValuesQuery,
  parseSheetsValuesWriteRequest,
} from '../api/contracts';

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../../${relative}`, import.meta.url)), 'utf8');

describe('Stage 4.4.4 Google Sheets payload/response contracts', () => {
  it('normalizes every Sheets request shape through one shared contract', () => {
    expect(parseSheetsMetadataQuery({ spreadsheetId: ' sheet-1 ' })).toEqual({
      spreadsheetId: 'sheet-1',
    });
    expect(() => parseSheetsMetadataQuery({ spreadsheetId: '' }))
      .toThrow('Missing required query parameter "spreadsheetId"');

    expect(parseSheetsValuesQuery({
      spreadsheetId: ' sheet-1 ',
      range: ' Sheet1!A1:B2 ',
    })).toEqual({
      spreadsheetId: 'sheet-1',
      range: 'Sheet1!A1:B2',
    });
    expect(() => parseSheetsValuesQuery({ spreadsheetId: 'sheet-1', range: '' }))
      .toThrow('Missing "spreadsheetId" or "range"');

    expect(parseSheetsValuesWriteRequest({
      spreadsheetId: 'sheet-1',
      range: 'Sheet1!A1:B2',
      values: [[1, 2]],
    })).toEqual({
      spreadsheetId: 'sheet-1',
      range: 'Sheet1!A1:B2',
      values: [[1, 2]],
      valueInputOption: 'USER_ENTERED',
    });

    expect(parseSheetsAppendRequest({
      spreadsheetId: 'sheet-1',
      range: 'Sheet1!A:B',
      values: [['x']],
      valueInputOption: 'RAW',
    })).toEqual({
      spreadsheetId: 'sheet-1',
      range: 'Sheet1!A:B',
      values: [['x']],
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
    });

    expect(parseSheetsBatchUpdateRequest({
      spreadsheetId: 'sheet-1',
      requests: [{ addSheet: { properties: { title: 'New' } } }],
    })).toEqual({
      spreadsheetId: 'sheet-1',
      requests: [{ addSheet: { properties: { title: 'New' } } }],
    });
  });

  it('normalizes provider responses identically for Express and Worker consumers', () => {
    const metadataProvider = {
      properties: { title: 'Portfolio' },
      sheets: [
        { properties: { title: 'Transactions', sheetId: 7 } },
        { properties: { title: '', sheetId: 8 } },
      ],
    };
    expect(createSheetsMetadataResponse(metadataProvider, 'oauth_bearer')).toEqual({
      title: 'Portfolio',
      sheets: ['Transactions'],
      sheetsInfo: [{ title: 'Transactions', sheetId: 7 }],
      authSource: 'oauth_bearer',
    });

    expect(createSheetsValuesResponse({
      range: 'Transactions!A1:B2',
      values: [[1, 2]],
    }, 'service_account')).toEqual({
      range: 'Transactions!A1:B2',
      values: [[1, 2]],
      authSource: 'service_account',
    });

    expect(createSheetsWriteValuesResponse({ updatedCells: 4 }, 'oauth_bearer')).toEqual({
      success: true,
      updatedCells: 4,
      authSource: 'oauth_bearer',
    });

    expect(createSheetsAppendResponse({ updates: { updatedRows: 1 } }, 'oauth_bearer')).toEqual({
      success: true,
      updates: { updatedRows: 1 },
      authSource: 'oauth_bearer',
    });

    expect(createSheetsBatchUpdateResponse({ replies: [{ addSheet: {} }] }, 'service_account')).toEqual({
      success: true,
      replies: [{ addSheet: {} }],
      authSource: 'service_account',
    });

    expect(createSheetsDriveFilesResponse({
      files: [
        {
          id: 'file-1',
          name: 'EGX Portfolio',
          modifiedTime: '2026-10-05T00:00:00Z',
          webViewLink: 'https://example.test/sheet',
        },
        { id: '', name: 'invalid' },
      ],
    }, 'oauth_bearer')).toEqual({
      files: [{
        id: 'file-1',
        name: 'EGX Portfolio',
        modifiedTime: '2026-10-05T00:00:00Z',
        webViewLink: 'https://example.test/sheet',
      }],
      authSource: 'oauth_bearer',
    });
  });

  it('makes both runtimes consume the same Sheets parsers and response builders', () => {
    const worker = read('worker.ts');
    const express = read('src/services/googleSheetsServer.ts');

    for (const runtime of [worker, express]) {
      for (const contract of [
        'parseSheetsMetadataQuery',
        'parseSheetsValuesQuery',
        'parseSheetsValuesWriteRequest',
        'parseSheetsAppendRequest',
        'parseSheetsBatchUpdateRequest',
        'createSheetsMetadataResponse',
        'createSheetsValuesResponse',
        'createSheetsWriteValuesResponse',
        'createSheetsAppendResponse',
        'createSheetsBatchUpdateResponse',
        'createSheetsDriveFilesResponse',
      ]) {
        expect(runtime).toContain(contract);
      }
    }
  });

  it('keeps browser Sheets calls on canonical API routes and shared response types', () => {
    const client = read('src/services/googleSheets.ts');

    for (const route of [
      'sheetsServiceAccountStatus',
      'sheetsDriveFiles',
      'sheetsMetadata',
      'sheetsValues',
      'sheetsBatchUpdate',
    ]) {
      expect(client).toContain(`API_ROUTES.${route}`);
    }

    expect(client).not.toContain("'/api/sheets/");
    expect(client).not.toContain('"\/api\/sheets\/');
    expect(client).toContain('SheetsMetadataResponse');
    expect(client).toContain('SheetsValuesResponse');
    expect(client).toContain('SheetsDriveFilesResponse');
  });

  it('keeps route ownership unchanged while consolidating payload schemas', () => {
    expect(API_ROUTES.sheetsMetadata).toBe('/api/sheets/metadata');
    expect(API_ROUTES.sheetsValues).toBe('/api/sheets/values');
    expect(API_ROUTES.sheetsAppend).toBe('/api/sheets/append');
    expect(API_ROUTES.sheetsBatchUpdate).toBe('/api/sheets/batchUpdate');
    expect(API_ROUTES.sheetsDriveFiles).toBe('/api/sheets/drive-files');
  });
});
