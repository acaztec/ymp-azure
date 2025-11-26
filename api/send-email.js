const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

function parseAddress(address) {
  if (!address) {
    return null;
  }

  if (typeof address === 'string') {
    const trimmed = address.trim();

    if (!trimmed) {
      return null;
    }

    const match = trimmed.match(/^(.*)<(.+)>$/);

    if (match) {
      const name = match[1].trim().replace(/^"|"$/g, '');
      const email = match[2].trim();

      if (!email) {
        return null;
      }

      return name ? { email, name } : { email };
    }

    return { email: trimmed };
  }

  if (typeof address === 'object' && address !== null) {
    const email = typeof address.email === 'string' ? address.email.trim() : '';

    if (!email) {
      return null;
    }

    const formatted = { email };

    if (address.name) {
      formatted.name = String(address.name).trim();
    }

    return formatted;
  }

  return null;
}

function parseRecipients(recipients) {
  if (!Array.isArray(recipients)) {
    const single = parseAddress(recipients);
    return single ? [single] : [];
  }

  return recipients
    .map(parseAddress)
    .filter((value) => value && value.email);
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.SENDGRID_API_KEY || SENDGRID_API_KEY;

    if (!apiKey) {
      res.status(500).json({ error: 'SendGrid API key is not configured' });
      return;
    }

    const { from, to, subject, html } = req.body || {};

    const fromAddress = parseAddress(from);
    const toAddresses = parseRecipients(to);

    if (!fromAddress) {
      res.status(400).json({ error: 'Missing or invalid "from" address' });
      return;
    }

    if (!toAddresses.length) {
      res.status(400).json({ error: 'At least one valid recipient is required' });
      return;
    }

    if (!subject) {
      res.status(400).json({ error: 'Email subject is required' });
      return;
    }

    if (!html) {
      res.status(400).json({ error: 'Email HTML content is required' });
      return;
    }

    const payload = {
      personalizations: [
        {
          to: toAddresses,
          subject,
        },
      ],
      from: fromAddress,
      subject,
      content: [
        {
          type: 'text/html',
          value: html,
        },
      ],
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', response.status, errorText);
      res.status(response.status).json({ error: errorText });
      return;
    }

    res.status(200).json({ message: 'Email accepted by SendGrid' });
  } catch (error) {
    console.error('Email sending error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unexpected error occurred while sending email',
    });
  }
}