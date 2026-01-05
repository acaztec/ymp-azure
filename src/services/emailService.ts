import { CompatibilityInsights, EmailNotification } from '../types';
import { buildAdvisorForwardingCopy, SAMPLE_REPORT_PLACEHOLDER_URL } from '../utils/advisorForwardingCopy';

const DEFAULT_FROM_ADDRESS = 'Money Personality <notifications@yourmoneypersonality.ai>';
// TODO: Update this placeholder address with the real internal lead notification recipient before launch.
const INTERNAL_NOTIFICATION_RECIPIENT = 'leads-placeholder@yourdomain.com';

export class EmailService {
  static async sendAssessmentInvitation(
    advisorName: string,
    advisorEmail: string,
    clientEmail: string,
    assessmentLink: string,
    clientName?: string,
  ): Promise<boolean> {
    try {
      const clientDisplayName = clientName || 'there';
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM_ADDRESS,
          to: [clientEmail],
          subject: `${advisorName} is asking you to discover your Money Personality!`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://media-cdn.igrad.com/IMAGE/Logos/Color/iGradEnrich.png" alt="iGrad Enrich" style="height: 40px;">
            </div>
            
            <h2 style="color: #2563eb; text-align: center;">Discover Your Money Personality</h2>
            
            <p>Hi ${clientDisplayName},</p>
            
            <p><strong>${advisorName}</strong> has invited you to take the Money Personality assessment to better understand your financial behaviors and decision-making patterns.</p>
            
            <p>This scientifically-designed assessment takes about 10 minutes and will help ${advisorName} provide you with more personalized financial guidance.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${assessmentLink}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-align: center;">
                Take Assessment Now
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              This assessment is completely confidential and your results will only be shared with ${advisorName} to help them better serve your financial needs.
            </p>
            
            <p style="font-size: 14px; color: #666;">
              If you have any questions, please contact ${advisorName} at ${advisorEmail}.
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This email was sent by iGrad Enrich Money Personality Assessment
            </p>
          </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending assessment invitation:', error);
      return false;
    }
  }

  static async sendInternalLeadNotification(
    advisorName: string,
    advisorEmail: string,
    clientEmail: string,
    assessmentLink: string,
    clientName?: string,
  ): Promise<boolean> {
    try {
      const clientDisplayName = clientName || 'Prospective client';

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM_ADDRESS,
          to: [INTERNAL_NOTIFICATION_RECIPIENT],
          subject: `New Money Personality referral from ${advisorName}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="https://media-cdn.igrad.com/IMAGE/Logos/Color/iGradEnrich.png" alt="iGrad Enrich" style="height: 36px;">
            </div>

            <h2 style="color: #2563eb; text-align: center; margin-bottom: 16px;">New Advisor Referral Submitted</h2>

            <p style="margin-bottom: 12px;">An advisor has just shared the Money Personality assessment:</p>
            <ul style="margin: 0 0 16px 20px; padding: 0; color: #111827;">
              <li><strong>Advisor:</strong> ${advisorName} (${advisorEmail})</li>
              <li><strong>Client:</strong> ${clientDisplayName} (${clientEmail})</li>
              <li><strong>Assessment Link:</strong> <a href="${assessmentLink}">${assessmentLink}</a></li>
            </ul>

            <p style="font-size: 14px; color: #4b5563; margin-bottom: 0;">Log this lead in CRM and follow up as needed.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">This alert was generated automatically by the Your Money Personality platform.</p>
          </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Internal lead notification error:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending internal lead notification:', error);
      return false;
    }
  }

  static async sendAdvisorShareConfirmation(
    advisorEmail: string,
    advisorName: string,
    clientEmail: string,
    assessmentLink: string,
    options?: { clientName?: string; qualifiesForTrial?: boolean; sampleReportUrl?: string },
  ): Promise<boolean> {
    try {
      const clientDisplayName = options?.clientName || clientEmail;
      const sampleReportUrl = options?.sampleReportUrl || SAMPLE_REPORT_PLACEHOLDER_URL;
      const qualifiesForTrial = Boolean(options?.qualifiesForTrial);
      const dashboardUrl = `${window.location.origin}/advisor/dashboard`;
      const copy = buildAdvisorForwardingCopy({
        clientDisplayName,
        advisorName,
      });
      const bulletItemsHtml = copy.bullets
        .map(
          item => `
            <li style="margin-bottom: 8px;">
              ${item}
            </li>
          `,
        )
        .join('');

      const trialHighlight = qualifiesForTrial
        ? `
          <div style="background-color: #ecfdf5; border: 1px solid #6ee7b7; border-radius: 8px; padding: 16px; margin: 24px 0;">
            <h3 style="margin: 0 0 8px; color: #047857;">Complimentary preview unlocked</h3>
            <p style="margin: 0; color: #065f46;">
              Because this is your first Money Personality invitation, you'll be able to review ${clientDisplayName}'s full results at no cost once they finish the assessment.
            </p>
          </div>
        `
        : `
          <p style="margin: 0 0 16px; color: #4b5563;">
            We'll follow up as soon as your client completes the assessment so you can unlock their full Money Personality report.
          </p>
        `;

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM_ADDRESS,
          to: [advisorEmail],
          subject: copy.subjectLine,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <img src="https://media-cdn.igrad.com/IMAGE/Logos/Color/iGradEnrich.png" alt="iGrad Enrich" style="height: 36px;">
            </div>

            <h2 style="color: #2563eb; text-align: center; margin-bottom: 16px;">${copy.headline}</h2>

            <p style="margin: 0 0 16px; color: #111827;">
              Hi ${advisorName || 'there'},
            </p>

            <p style="margin: 0 0 16px; color: #4b5563;">
              ${copy.intro}
            </p>

            <ul style="margin: 0 0 24px 20px; padding: 0; color: #111827;">
              ${bulletItemsHtml}
            </ul>

            ${trialHighlight}

            <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px; color: #1f2937;">${copy.sample.heading}</h3>
              <p style="margin: 0 0 12px; color: #4b5563;">
                ${copy.sample.description}
              </p>
              <a href="${sampleReportUrl}" style="display: inline-block; border: 1px solid #2563eb; color: #2563eb; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">${copy.sample.ctaLabel}</a>
            </div>

            <div style="background: #eef2ff; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <h3 style="margin: 0 0 8px; color: #3730a3;">Need the link again?</h3>
              <p style="margin: 0 0 8px; color: #4338ca;">You can copy or resend the assessment link anytime:</p>
              <a href="${assessmentLink}" style="display: inline-block; background-color: #4338ca; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">Open invite link</a>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 12px; color: #4b5563;">
                ${copy.dashboard.description}
              </p>
              <a href="${dashboardUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">${copy.dashboard.ctaLabel}</a>
            </div>

            <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; color: #4b5563;">
              <p style="margin: 0 0 12px;">${copy.support}</p>
              <p style="margin: 0 0 12px;">${copy.closing}</p>
              <p style="margin: 0; font-weight: 600;">${copy.signature}</p>
            </div>
          </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Advisor confirmation email error:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending advisor share confirmation:', error);
      return false;
    }
  }

  static async sendCompletionNotification(
    advisorEmail: string,
    advisorName: string,
    clientEmail: string,
    clientName?: string
  ): Promise<boolean> {
    try {
      const clientDisplayName = clientName || 'Your client';
      
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM_ADDRESS,
          to: [advisorEmail],
          subject: `Money Personality Assessment Completed${clientName ? ` - ${clientName}` : ''}`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://media-cdn.igrad.com/IMAGE/Logos/Color/iGradEnrich.png" alt="iGrad Enrich" style="height: 40px;">
            </div>
            
            <h2 style="color: #22c55e; text-align: center;">Assessment Completed! ✅</h2>
            
            <p>Hi ${advisorName},</p>
            
            <p><strong>${clientDisplayName}</strong> (${clientEmail}) has completed their Money Personality assessment!</p>
            
            <p>You can now access their detailed results, including:</p>
            <ul>
              <li>Complete personality profile across 5 dimensions</li>
              <li>Behavioral strengths and challenges</li>
              <li>Personalized action plans</li>
              <li>AI-powered advisor recommendations</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/advisor/dashboard" style="background-color: #22c55e; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                View Dashboard
              </a>
            </div>
            
            <p style="font-size: 14px; color: #666;">
              Use these insights to provide more personalized financial guidance and build stronger client relationships.
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            
            <p style="font-size: 12px; color: #999; text-align: center;">
              This email was sent by iGrad Enrich Money Personality Assessment
            </p>
          </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending completion notification:', error);
      return false;
    }
  }

  static async sendFriendAssessmentInvitation(
    sharerName: string,
    sharerEmail: string,
    recipientEmail: string,
    assessmentLink: string,
    relationship: string,
    personalNote?: string
  ): Promise<boolean> {
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM_ADDRESS,
          to: [recipientEmail],
          subject: `${sharerName} invited you to discover your Money Personality`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://media-cdn.igrad.com/IMAGE/Logos/Color/iGradEnrich.png" alt="iGrad Enrich" style="height: 40px;">
            </div>

            <h2 style="color: #2563eb; text-align: center;">${sharerName} wants to compare Money Personalities!</h2>

            <p>Hello there,</p>

            <p><strong>${sharerName}</strong> would love for you to take the Money Personality assessment so you can explore how your perspectives on money work together as ${relationship.toLowerCase()}.</p>

            ${personalNote ? `<p style="background-color: #eff6ff; padding: 16px; border-radius: 8px;">${personalNote}</p>` : ''}

            <p>The assessment only takes about 10 minutes. Once you are finished, you'll both receive a compatibility breakdown that highlights strengths, watch-outs, and conversation starters tailored to your results.</p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${assessmentLink}" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; text-align: center;">
                Take Assessment Now
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">Questions? You can reply directly to ${sharerEmail}.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

            <p style="font-size: 12px; color: #999; text-align: center;">
              This email was sent by iGrad Enrich Money Personality Assessment
            </p>
          </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending friend assessment invitation:', error);
      return false;
    }
  }

  static async sendFriendCompletionNotification(
    sharerEmail: string,
    sharerName: string,
    participantEmail: string,
    compatibility: CompatibilityInsights
  ): Promise<boolean> {
    try {
      const highlightsList = compatibility.alignmentHighlights.slice(0, 2).map(item => `<li>${item}</li>`).join('');
      const watchoutsList = compatibility.potentialFriction.slice(0, 2).map(item => `<li>${item}</li>`).join('');

      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: DEFAULT_FROM_ADDRESS,
          to: [sharerEmail],
          subject: `${participantEmail} finished the Money Personality assessment!`,
          html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <img src="https://media-cdn.igrad.com/IMAGE/Logos/Color/iGradEnrich.png" alt="iGrad Enrich" style="height: 40px;">
            </div>

            <h2 style="color: #16a34a; text-align: center;">Compatibility insights are ready</h2>

            <p>Hi ${sharerName},</p>

            <p><strong>${participantEmail}</strong> just completed the Money Personality assessment. Here's a preview of your compatibility results:</p>

            <p style="font-weight: bold;">Score: ${compatibility.compatibilityScore} (${compatibility.compatibilityLabel})</p>
            <p>${compatibility.summary}</p>

            ${highlightsList ? `<h3>Shared strengths</h3><ul>${highlightsList}</ul>` : ''}
            ${watchoutsList ? `<h3>Conversation opportunities</h3><ul>${watchoutsList}</ul>` : ''}

            <div style="text-align: center; margin: 30px 0;">
              <a href="${window.location.origin}/dashboard" style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                View Full Compatibility Insights
              </a>
            </div>

            <p style="font-size: 14px; color: #666;">Keep the momentum going by scheduling a quick money check-in together.</p>

            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">

            <p style="font-size: 12px; color: #999; text-align: center;">
              This email was sent by iGrad Enrich Money Personality Assessment
            </p>
          </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Email API error:', response.status, errorText);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error sending friend completion notification:', error);
      return false;
    }
  }
}
