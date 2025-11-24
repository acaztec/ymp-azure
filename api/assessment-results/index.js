import { query } from '../_shared/db.js';

export default async function (context, req) {
  const action = context.bindingData.action;

  try {
    switch (action) {
      case 'complete':
        await handleComplete(context, req);
        break;
      case 'by-advisor':
        await handleByAdvisor(context, req);
        break;
      case 'get':
        await handleGet(context, req);
        break;
      case 'unlock':
        await handleUnlock(context, req);
        break;
      default:
        context.res = { status: 400, jsonBody: { error: 'Unknown action' } };
    }
  } catch (error) {
    context.log.error('Assessment results function error', error);
    context.res = { status: 500, jsonBody: { error: error?.message || 'Internal server error' } };
  }
}

async function handleComplete(context, req) {
  const body = req.body || {};
  const { assessmentId, advisorEmail, clientEmail, clientName, answers, profile, advisorSummary } = body;

  if (!assessmentId || !advisorEmail || !clientEmail || !answers || !profile) {
    context.res = { status: 400, jsonBody: { error: 'Missing required fields' } };
    return;
  }

  const insertResult = await query(
    `INSERT INTO assessment_results (assessment_id, advisor_email, client_email, client_name, answers, profile, advisor_summary, is_unlocked)
     OUTPUT INSERTED.*
     VALUES (@assessmentId, @advisorEmail, @clientEmail, @clientName, @answers, @profile, @advisorSummary, 0)`,
    {
      assessmentId,
      advisorEmail,
      clientEmail,
      clientName,
      answers: JSON.stringify(answers),
      profile: JSON.stringify(profile),
      advisorSummary,
    }
  );

  await query(
    'UPDATE advisor_assessments SET status = @status, completed_at = GETUTCDATE() WHERE id = @assessmentId',
    { status: 'completed', assessmentId }
  );

  context.res = { jsonBody: insertResult.recordset[0] };
}

async function handleByAdvisor(context, req) {
  const advisorEmail = (req.query.advisorEmail || '').toString();
  if (!advisorEmail) {
    context.res = { status: 400, jsonBody: { error: 'advisorEmail is required' } };
    return;
  }

  const result = await query(
    'SELECT * FROM assessment_results WHERE LOWER(advisor_email) = LOWER(@advisorEmail) ORDER BY completed_at DESC',
    { advisorEmail }
  );
  context.res = { jsonBody: result.recordset };
}

async function handleGet(context, req) {
  const assessmentId = (req.query.assessmentId || '').toString();
  if (!assessmentId) {
    context.res = { status: 400, jsonBody: { error: 'assessmentId is required' } };
    return;
  }

  const result = await query('SELECT * FROM assessment_results WHERE assessment_id = @assessmentId', { assessmentId });
  const record = result.recordset[0];
  if (!record) {
    context.res = { status: 404, jsonBody: { error: 'Assessment result not found' } };
    return;
  }
  context.res = { jsonBody: record };
}

async function handleUnlock(context, req) {
  const { assessmentId } = req.body || {};
  if (!assessmentId) {
    context.res = { status: 400, jsonBody: { error: 'assessmentId is required' } };
    return;
  }

  const timestamp = new Date().toISOString();
  await query('UPDATE advisor_assessments SET is_paid = 1, paid_at = @timestamp WHERE id = @assessmentId', {
    assessmentId,
    timestamp,
  });
  await query('UPDATE assessment_results SET is_unlocked = 1, unlocked_at = @timestamp WHERE assessment_id = @assessmentId', {
    assessmentId,
    timestamp,
  });

  context.res = { jsonBody: { success: true, unlocked_at: timestamp } };
}
