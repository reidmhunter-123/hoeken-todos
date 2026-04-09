import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`
);

async function getGmailClient() {
  const { data: tokenData, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !tokenData) {
    throw new Error('No Gmail tokens found. Please authorize Gmail first.');
  }

  oauth2Client.setCredentials({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expiry_date: tokenData.expiry_date,
  });

  oauth2Client.on('tokens', async (tokens) => {
    await supabase
      .from('gmail_tokens')
      .update({
        access_token: tokens.access_token!,
        expiry_date: tokens.expiry_date,
        updated_at: new Date().toISOString(),
      })
      .eq('email', tokenData.email);
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

async function extractTodosFromEmail(
  emailId: string,
  subject: string,
  from: string,
  date: string,
  body: string
): Promise<{ task: string; category: string; priority: string }[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: `You are an assistant for Reid Hunter, a Homebuild Consultant at Hoeken Design Build in Raleigh, NC. He also serves as Vice Chair of TSMC (Triangle Sales and Marketing Council).

Analyze this email and extract ONLY genuine action items -- things Reid actually needs to do, respond to, or follow up on.

Email Subject: ${subject}
From: ${from}
Date: ${date}
Body:
${body}

EXTRACT action items when:
- A real person (client, prospect, colleague, attorney, lender, contractor) is directly asking Reid to do something
- A document, form, or information has been requested and not yet provided
- A client or prospect has responded positively and warrants a proactive follow-up
- Reid is CC'd on an email where he has a clear implied responsibility
- A deadline or time-sensitive matter is mentioned
- A colleague (Uriah, Voz, Earl, Katie) has made a direct ask

DO NOT extract action items from:
- Newsletters, digests, or promotional emails
- Calendar invite confirmations where no action is needed
- Automated system notifications with no human ask
- Emails where Reid is just being kept informed with no action required
- Marketing emails from any company or service

Key people Reid works with: Uriah Dortch (owner), Voz/David Voznyuk (preconstruction), Earl Castillo (team), Katie Dortch (team).
Key active projects: Sage Court listings (604/608), Yadkin Drive land, Singh build, Noonans/331 Erwin Rd, 907 Danbury Durham closing, Jun Zhang prospect, Ellen Osbourne feasibility, Kelly Beard feasibility.

Return ONLY a JSON array of action items. Each item should have:
- task: clear, specific action Reid needs to take (start with a verb, include relevant names/addresses)
- category: one of [Client Follow-up, Listing, Internal, TSMC, Vendor, Legal/Contract, Marketing, Other]
- priority: one of [high, medium, low]

If there are no genuine action items, return an empty array [].
Return ONLY valid JSON, no other text.`,
      },
    ],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '[]';
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return [];
  }
}

function collectParts(payload: any, plain: string[], html: string[]): void {
  if (!payload) return;
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    plain.push(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
  } else if (payload.mimeType === 'text/html' && payload.body?.data) {
    html.push(Buffer.from(payload.body.data, 'base64').toString('utf-8'));
  }
  for (const part of payload.parts ?? []) {
    collectParts(part, plain, html);
  }
}

function getEmailBody(payload: any): string {
  if (!payload) return '';
  const plain: string[] = [];
  const html: string[] = [];
  collectParts(payload, plain, html);
  if (plain.length) return plain.join('\n');
  if (html.length) return html.join('\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return '';
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const gmail = await getGmailClient();

    // Look back 24 hours to ensure full coverage even if a cron run was delayed
    const hoursAgo = new Date();
    hoursAgo.setHours(hoursAgo.getHours() - 3);
    const after = Math.floor(hoursAgo.getTime() / 1000);

    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `after:${after} in:inbox`,
      maxResults: 50,
    });

    const messages = listResponse.data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ success: true, emailsProcessed: 0, todosCreated: 0, timestamp: new Date().toISOString() });
    }

    // Fetch which email IDs we've already processed
    const messageIds = messages.map((m) => m.id!);
    const { data: alreadyScanned } = await supabase
      .from('scanned_emails')
      .select('email_id')
      .in('email_id', messageIds);

    const scannedSet = new Set((alreadyScanned || []).map((r) => r.email_id));
    const unprocessed = messages.filter((m) => !scannedSet.has(m.id!));

    let todosCreated = 0;
    let emailsProcessed = 0;

    for (const message of unprocessed) {
      const msgData = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const headers = msgData.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || '(No Subject)';
      const from = headers.find((h) => h.name === 'From')?.value || '';
      const date = headers.find((h) => h.name === 'Date')?.value || '';
      const body = getEmailBody(msgData.data.payload);

      // Mark as scanned immediately so even emails with no todos aren't re-processed
      await supabase.from('scanned_emails').insert({ email_id: message.id!, scanned_at: new Date().toISOString() });

      if (!body || body.length < 50) continue;

      const truncatedBody = body.substring(0, 3000);
      const todos = await extractTodosFromEmail(message.id!, subject, from, date, truncatedBody);
      emailsProcessed++;

      for (const todo of todos) {
        const { error } = await supabase.from('todos').insert({
          source_email_id: message.id!,
          source_email_subject: subject,
          source_email_from: from,
          source_email_date: isNaN(new Date(date).getTime()) ? null : new Date(date).toISOString(),
          task: todo.task,
          category: todo.category,
          priority: todo.priority,
          status: 'pending',
          updated_at: new Date().toISOString(),
        });
        if (!error) todosCreated++;
      }
    }

    return NextResponse.json({
      success: true,
      emailsProcessed,
      todosCreated,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Scan error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
