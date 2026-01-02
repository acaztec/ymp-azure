import crypto from 'crypto';
import { query } from '../_shared/db';
function normalizeEmail(email) {
    return email?.trim().toLowerCase();
}
function hashPassword(password, salt) {
    const saltToUse = salt || crypto.randomBytes(16).toString('hex');
    const derived = crypto.scryptSync(password, saltToUse, 64).toString('hex');
    return `${saltToUse}:${derived}`;
}
function verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash)
        return false;
    const computed = hashPassword(password, salt).split(':')[1];
    try {
        return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
    }
    catch {
        return false;
    }
}
function mapAdvisor(record) {
    return {
        id: record.id,
        user_id: record.user_id || record.id,
        email: record.email,
        name: record.name,
        company: record.company ?? null,
        created_at: record.created_at,
    };
}
async function ensureUserTable() {
    await query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[advisor_profiles]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [dbo].[advisor_profiles](
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [user_id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        [email] NVARCHAR(255) NOT NULL UNIQUE,
        [password_hash] NVARCHAR(512) NOT NULL,
        [name] NVARCHAR(255) NOT NULL,
        [company] NVARCHAR(255) NULL,
        [created_at] DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME(),
        [updated_at] DATETIMEOFFSET NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT [PK_advisor_profiles] PRIMARY KEY CLUSTERED ([id] ASC)
      );
    END;

    IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_advisor_profiles_email')
    BEGIN
      CREATE UNIQUE INDEX [IX_advisor_profiles_email] ON [dbo].[advisor_profiles]([email]);
    END;
  `);
}
const authFunction = async function (context, req) {
    const action = context.bindingData.action;
    try {
        await ensureUserTable();
        switch (action) {
            case 'signup':
                await handleSignup(context, req);
                break;
            case 'login':
                await handleLogin(context, req);
                break;
            case 'profile':
                await handleProfile(context, req);
                break;
            default:
                context.res = { status: 400, jsonBody: { error: 'Unknown action' } };
        }
    }
    catch (error) {
        context.log.error('Auth function error', { error, action });
        context.res = {
            status: 500,
            jsonBody: {
                error: 'Internal server error',
                message: error?.message || 'An unexpected error occurred while handling the request',
            },
        };
    }
};
async function handleSignup(context, req) {
    const { email, password, name, company } = req.body || {};
    const normalizedEmail = normalizeEmail(email || '');
    if (!normalizedEmail || !password || !name) {
        context.res = { status: 400, jsonBody: { error: 'Email, password, and name are required' } };
        return;
    }
    if (password.length < 8) {
        context.res = { status: 400, jsonBody: { error: 'Password must be at least 8 characters' } };
        return;
    }
    const existing = await query('SELECT TOP 1 * FROM advisor_profiles WHERE LOWER(email) = LOWER(@email)', { email: normalizedEmail });
    if (existing.recordset?.length) {
        context.res = { status: 409, jsonBody: { error: 'An account with this email already exists' } };
        return;
    }
    const passwordHash = hashPassword(password);
    const insertResult = await query(`INSERT INTO advisor_profiles (email, password_hash, name, company)
     OUTPUT INSERTED.*
     VALUES (@email, @password_hash, @name, @company)`, { email: normalizedEmail, password_hash: passwordHash, name, company: company || null });
    const advisor = mapAdvisor(insertResult.recordset[0]);
    context.res = { jsonBody: { advisor } };
}
async function handleLogin(context, req) {
    const { email, password } = req.body || {};
    const normalizedEmail = normalizeEmail(email || '');
    if (!normalizedEmail || !password) {
        context.res = { status: 400, jsonBody: { error: 'Email and password are required' } };
        return;
    }
    const result = await query('SELECT TOP 1 * FROM advisor_profiles WHERE LOWER(email) = LOWER(@email)', { email: normalizedEmail });
    const record = result.recordset?.[0];
    if (!record || !verifyPassword(password, record.password_hash)) {
        context.res = { status: 401, jsonBody: { error: 'Invalid email or password' } };
        return;
    }
    const advisor = mapAdvisor(record);
    context.res = { jsonBody: { advisor } };
}
async function handleProfile(context, req) {
    const userId = (req.query.userId || req.query.id || '').toString();
    const email = normalizeEmail((req.query.email || '').toString());
    if (!userId && !email) {
        context.res = { status: 400, jsonBody: { error: 'userId or email is required' } };
        return;
    }
    let sqlText = 'SELECT TOP 1 * FROM advisor_profiles WHERE 1=1';
    const params = {};
    if (userId) {
        sqlText += ' AND id = @id';
        params.id = userId;
    }
    if (email) {
        sqlText += ' AND LOWER(email) = LOWER(@email)';
        params.email = email;
    }
    const result = await query(sqlText, params);
    const record = result.recordset?.[0];
    if (!record) {
        context.res = { status: 404, jsonBody: { error: 'Advisor not found' } };
        return;
    }
    context.res = { jsonBody: { advisor: mapAdvisor(record) } };
}
export default authFunction;
