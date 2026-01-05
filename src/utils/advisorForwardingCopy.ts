export const SAMPLE_REPORT_PLACEHOLDER_URL = 'https://yourmoneypersonality.com/sample-report-placeholder.pdf';

export interface AdvisorForwardingCopy {
  subjectLine: string;
  headline: string;
  intro: string;
  bullets: string[];
  sample: {
    heading: string;
    description: string;
    ctaLabel: string;
  };
  dashboard: {
    description: string;
    ctaLabel: string;
  };
  support: string;
  closing: string;
  signature: string;
}

interface BuildAdvisorForwardingCopyParams {
  clientDisplayName: string;
  advisorName?: string | null;
}

export function buildAdvisorForwardingCopy({
  clientDisplayName,
  advisorName,
}: BuildAdvisorForwardingCopyParams): AdvisorForwardingCopy {
  const trimmedAdvisorName = advisorName?.trim();
  const nameSuffix = trimmedAdvisorName ? ` from ${trimmedAdvisorName}` : '';

  return {
    subjectLine: `Thank you for forwarding YMP to ${clientDisplayName}`,
    headline: 'Thank you for forwarding YMP to your client! 🎉',
    intro: `We've just sent ${clientDisplayName} a secure link to discover their Money Personality${nameSuffix}.`,
    bullets: [
      'The invitation will arrive in the next few minutes from Money Personality (notifications@yourmoneypersonality.ai).',
      'We will email you again as soon as your client completes the assessment so you can review their full report and AI insights.',
      'Visit your advisor dashboard anytime to monitor invitations, resend links, or unlock completed Money Personality reports.',
    ],
    sample: {
      heading: 'Show clients the experience',
      description:
        "While you wait, preview the Money Personality summary and AI insights they'll see once you unlock their results.",
      ctaLabel: 'Download sample report',
    },
    dashboard: {
      description: 'Ready to manage invitations or explore pricing? Head to your advisor dashboard to take the next step.',
      ctaLabel: 'Open advisor dashboard',
    },
    support:
      'Need to update details or have a question? Reply to this email or contact support@yourmoneypersonality.ai and our team will help.',
    closing: 'Thanks again for introducing Money Personality to your clients—deeper conversations start here.',
    signature: '— The Your Money Personality Team',
  };
}
