import { query } from '../_shared/db.js';

export default async function (context, req) {
  const action = context.bindingData.action;

  try {
    switch (action) {
      case 'trial-eligibility':
        await handleTrialEligibility(context, req);
        break;
      case 'create':
        await handleCreate(context, req);
        break;
      case 'confirm':
        await handleConfirm(context, req);
        break;
      case 'get':
        await handleGet(context, req);
        break;
      case 'delete':
        await handleDelete(context, req);
        break;
      case 'by-advisor':
        await handleList(context, req);
        break;
      default:
        context.res = { status: 400, jsonBody: { error: 'Unknown action' } };
    }
  } catch (error) {
    context.log.error('Assessments function error', error);
    context.res = {
      status: 500,
      jsonBody: {
        error: 'Internal server error',
        message: error?.message || 'An unexpected error occurred while handling the request',
      },
    };
  }
}

async function handleTrialEligibility(context, req) {
  const advisorEmail = (req.query.advisorEmail || req.query.email || '').toLowerCase();
  if (!advisorEmail) {
    context.res = { status: 400, jsonBody: { error: 'advisorEmail is required' } };
    return;
  }

  const result = await query(
    'SELECT COUNT(*) as count FROM advisor_assessments WHERE LOWER(advisor_email) = LOWER(@advisorEmail)',
    { advisorEmail }
  );

  const count = result.recordset[0]?.count || 0;
  context.res = { jsonBody: { qualifiesForTrial: count === 0, count } };
}

async function handleCreate(context, req) {
  const body = req.body || {};
  const { id, advisorEmail, advisorName, clientEmail, clientName, assessmentLink, isTrial } = body;

  if (!id || !advisorEmail || !advisorName || !clientEmail || !assessmentLink) {
    context.res = { status: 400, jsonBody: { error: 'Missing required fields' } };
    return;
  }

  const result = await query(
    `INSERT INTO advisor_assessments (id, advisor_email, advisor_name, client_email, client_name, status, assessment_link, is_trial, sent_at)
     OUTPUT INSERTED.*
     VALUES (@id, @advisorEmail, @advisorName, @clientEmail, @clientName, 'sent', @assessmentLink, @isTrial, GETUTCDATE())`,
    {
      id,
      advisorEmail,
      advisorName,
      clientEmail,
      clientName,
      assessmentLink,
      isTrial: !!isTrial,
    }
  );

  context.res = { jsonBody: result.recordset[0] };
}

async function handleConfirm(context, req) {
  const { assessmentId, confirmationSentAt } = req.body || {};
  if (!assessmentId) {
    context.res = { status: 400, jsonBody: { error: 'assessmentId is required' } };
    return;
  }

  const timestamp = confirmationSentAt || new Date().toISOString();
  await query(
    'UPDATE advisor_assessments SET confirmation_sent_at = @timestamp WHERE id = @assessmentId',
    { assessmentId, timestamp }
  );

  context.res = { jsonBody: { success: true, confirmation_sent_at: timestamp } };
}

async function handleGet(context, req) {
  const id = req.query.id;
  if (!id) {
    context.res = { status: 400, jsonBody: { error: 'id is required' } };
    return;
  }

  const result = await query('SELECT * FROM advisor_assessments WHERE id = @id', { id });
  const record = result.recordset[0];
  if (!record) {
    context.res = { status: 404, jsonBody: { error: 'Assessment not found' } };
    return;
  }
  context.res = { jsonBody: record };
}

async function handleDelete(context, req) {
  const { assessmentId } = req.body || {};
  if (!assessmentId) {
    context.res = { status: 400, jsonBody: { error: 'assessmentId is required' } };
    return;
  }

  await query('DELETE FROM assessment_results WHERE assessment_id = @assessmentId', { assessmentId });
  await query('DELETE FROM advisor_assessments WHERE id = @assessmentId', { assessmentId });

  context.res = { jsonBody: { success: true } };
}

async function handleList(context, req) {
  const advisorEmail = (req.query.advisorEmail || '').toString();
  const advisorName = (req.query.advisorName || '').toString();
  if (!advisorEmail && !advisorName) {
    context.res = { status: 400, jsonBody: { error: 'advisorEmail or advisorName is required' } };
    return;
  }

  let sqlText = 'SELECT * FROM advisor_assessments';
  const params = {};
  if (advisorEmail) {
    sqlText += ' WHERE LOWER(advisor_email) = LOWER(@advisorEmail)';
    params.advisorEmail = advisorEmail;
  } else {
    sqlText += ' WHERE advisor_name = @advisorName';
    params.advisorName = advisorName;
  }
  sqlText += ' ORDER BY sent_at DESC';

  const result = await query(sqlText, params);
  context.res = { jsonBody: result.recordset };
}
