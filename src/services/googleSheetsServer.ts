import { JWT, GoogleAuth } from 'google-auth-library';
import type { Request, Response } from 'express';

const SHEETS_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
];

interface ServiceAccountCredentials {
  client_email?: string;
  private_key?: string;
  project_id?: string;
}

let cachedJwtClient: JWT | null = null;
let cachedServiceAccountEmail: string | null = null;

function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  // 1. Direct JSON string in env var
  const jsonKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (jsonKey) {
    try {
      const parsed = JSON.parse(jsonKey.trim());
      if (parsed.client_email && parsed.private_key) {
        return parsed;
      }
    } catch (e) {
      console.warn('[Google Sheets Server] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:', e);
    }
  }

  // 2. Separate email + private key
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && privateKey) {
    // Unescape newlines if needed
    privateKey = privateKey.replace(/\\n/g, '\n');
    return {
      client_email: email,
      private_key: privateKey,
      project_id: process.env.GOOGLE_PROJECT_ID || process.env.GCP_PROJECT,
    };
  }

  return null;
}

export function isServiceAccountConfigured(): boolean {
  return Boolean(getServiceAccountCredentials());
}

export function getServiceAccountEmail(): string | null {
  const creds = getServiceAccountCredentials();
  return creds?.client_email || null;
}

export async function getServerSheetsAccessToken(req?: Request): Promise<{ token: string; source: 'service_account' | 'oauth_bearer' }> {
  // Try service account first for rock-solid 24/7 continuous sync
  const creds = getServiceAccountCredentials();
  if (creds && creds.client_email && creds.private_key) {
    try {
      if (!cachedJwtClient || cachedServiceAccountEmail !== creds.client_email) {
        cachedJwtClient = new JWT({
          email: creds.client_email,
          key: creds.private_key,
          scopes: SHEETS_SCOPES,
        });
        cachedServiceAccountEmail = creds.client_email;
      }

      const tokenResponse = await cachedJwtClient.getAccessToken();
      if (tokenResponse?.token) {
        return { token: tokenResponse.token, source: 'service_account' };
      }
    } catch (err) {
      console.error('[Google Sheets Server] Error obtaining Service Account access token:', err);
    }
  }

  // Fallback to client-provided bearer token
  const authHeader = req?.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    if (bearerToken && bearerToken !== 'null' && bearerToken !== 'undefined') {
      return { token: bearerToken, source: 'oauth_bearer' };
    }
  }

  throw new Error(
    'No valid Google Sheets credentials found. Please set up a Google Service Account in environment settings or sign in with Google.'
  );
}

// --------------------------------------------------------------------------
// EXPRESS ENDPOINT HANDLERS
// --------------------------------------------------------------------------

export function handleGetServiceAccountStatus(_req: Request, res: Response) {
  const email = getServiceAccountEmail();
  res.json({
    configured: Boolean(email),
    serviceAccountEmail: email || null,
    instruction: email
      ? `Share your Google Sheet with '${email}' and give it 'Editor' access.`
      : 'Configure GOOGLE_SERVICE_ACCOUNT_KEY in settings for 24/7 sync without hourly token expiry.',
  });
}

export async function handleGetSpreadsheetMetadata(req: Request, res: Response) {
  try {
    const spreadsheetId = String(req.query.spreadsheetId || '').trim();
    if (!spreadsheetId) {
      return res.status(400).json({ error: 'Missing required query parameter "spreadsheetId"' });
    }

    const { token, source } = await getServerSheetsAccessToken(req);
    const googleRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google Sheets API error (${googleRes.status}): ${errText}`,
        authSource: source,
        isAuthError: googleRes.status === 401 || googleRes.status === 403,
      });
    }

    const data = await googleRes.json();
    const sheets = (data.sheets || []).map((s: any) => s.properties?.title || '').filter(Boolean);
    const sheetsInfo = (data.sheets || []).map((s: any) => ({
      title: s.properties?.title || '',
      sheetId: s.properties?.sheetId ?? 0,
    })).filter((s: any) => Boolean(s.title));
    res.json({
      title: data.properties?.title || '',
      sheets,
      sheetsInfo,
      authSource: source,
    });
  } catch (err: any) {
    console.error('[Google Sheets Server] Get metadata error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch spreadsheet metadata' });
  }
}

export async function handleGetSheetValues(req: Request, res: Response) {
  try {
    const spreadsheetId = String(req.query.spreadsheetId || '').trim();
    const range = String(req.query.range || '').trim();
    if (!spreadsheetId || !range) {
      return res.status(400).json({ error: 'Missing "spreadsheetId" or "range"' });
    }

    const { token, source } = await getServerSheetsAccessToken(req);
    const encodedRange = encodeURIComponent(range);
    const googleRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google Sheets API error (${googleRes.status}): ${errText}`,
        authSource: source,
        isAuthError: googleRes.status === 401 || googleRes.status === 403,
      });
    }

    const data = await googleRes.json();
    res.json({
      values: data.values || [],
      range: data.range,
      authSource: source,
    });
  } catch (err: any) {
    console.error('[Google Sheets Server] Get values error:', err);
    res.status(500).json({ error: err.message || 'Failed to get sheet values' });
  }
}

export async function handlePutSheetValues(req: Request, res: Response) {
  try {
    const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED' } = req.body;
    if (!spreadsheetId || !range || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Missing spreadsheetId, range, or values array' });
    }

    const { token, source } = await getServerSheetsAccessToken(req);
    const encodedRange = encodeURIComponent(range);
    const googleRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}?valueInputOption=${valueInputOption}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google Sheets API error (${googleRes.status}): ${errText}`,
        authSource: source,
        isAuthError: googleRes.status === 401 || googleRes.status === 403,
      });
    }

    const data = await googleRes.json();
    res.json({ success: true, updatedCells: data.updatedCells, authSource: source });
  } catch (err: any) {
    console.error('[Google Sheets Server] Put values error:', err);
    res.status(500).json({ error: err.message || 'Failed to update sheet values' });
  }
}

export async function handleAppendSheetValues(req: Request, res: Response) {
  try {
    const { spreadsheetId, range, values, valueInputOption = 'USER_ENTERED', insertDataOption = 'INSERT_ROWS' } = req.body;
    if (!spreadsheetId || !range || !Array.isArray(values)) {
      return res.status(400).json({ error: 'Missing spreadsheetId, range, or values' });
    }

    const { token, source } = await getServerSheetsAccessToken(req);
    const encodedRange = encodeURIComponent(range);
    const googleRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=${valueInputOption}&insertDataOption=${insertDataOption}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google Sheets API error (${googleRes.status}): ${errText}`,
        authSource: source,
        isAuthError: googleRes.status === 401 || googleRes.status === 403,
      });
    }

    const data = await googleRes.json();
    res.json({ success: true, updates: data.updates, authSource: source });
  } catch (err: any) {
    console.error('[Google Sheets Server] Append values error:', err);
    res.status(500).json({ error: err.message || 'Failed to append sheet values' });
  }
}

export async function handleBatchUpdate(req: Request, res: Response) {
  try {
    const { spreadsheetId, requests } = req.body;
    if (!spreadsheetId || !Array.isArray(requests)) {
      return res.status(400).json({ error: 'Missing spreadsheetId or requests array' });
    }

    const { token, source } = await getServerSheetsAccessToken(req);
    const googleRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google Sheets API error (${googleRes.status}): ${errText}`,
        authSource: source,
        isAuthError: googleRes.status === 401 || googleRes.status === 403,
      });
    }

    const data = await googleRes.json();
    res.json({ success: true, replies: data.replies, authSource: source });
  } catch (err: any) {
    console.error('[Google Sheets Server] Batch update error:', err);
    res.status(500).json({ error: err.message || 'Failed to execute batch update' });
  }
}

export async function handleListDriveSpreadsheets(req: Request, res: Response) {
  try {
    const { token, source } = await getServerSheetsAccessToken(req);
    const query = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet' and trashed=false");
    const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name,modifiedTime,webViewLink)&orderBy=modifiedTime desc&pageSize=30`;

    const googleRes = await fetch(driveUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!googleRes.ok) {
      const errText = await googleRes.text();
      return res.status(googleRes.status).json({
        error: `Google Drive API error (${googleRes.status}): ${errText}`,
        authSource: source,
        isAuthError: googleRes.status === 401 || googleRes.status === 403,
      });
    }

    const data = await googleRes.json();
    res.json({ files: data.files || [], authSource: source });
  } catch (err: any) {
    console.error('[Google Sheets Server] List drive spreadsheets error:', err);
    res.status(500).json({ error: err.message || 'Failed to list drive spreadsheets' });
  }
}
