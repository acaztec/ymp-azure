import { AdvisorAssessment, FriendAssessmentShare, Profile } from '../types';
import { EmailService } from './emailService';
import { AuthService } from './authService';
import { callApi } from '../utils/apiClient';
import { getOrCreateUserId } from '../utils/userIdentity';
import { generateCompatibilityInsights } from '../utils/compatibilityInsights';
import { generateAdvisorSummary } from './aiService';
import { stripeService } from './stripeService';

export interface DatabaseAdvisorAssessment {
  id: string;
  advisor_email: string;
  advisor_name: string;
  client_email: string;
  client_name?: string;
  status: 'sent' | 'completed';
  assessment_link: string;
  sent_at: string;
  completed_at?: string;
  is_paid: boolean;
  paid_at?: string | null;
  is_trial?: boolean;
  confirmation_sent_at?: string | null;
}

export interface DatabaseAssessmentResult {
  id: string;
  assessment_id: string;
  advisor_email: string;
  client_email: string;
  client_name?: string | null;
  answers: any;
  profile: any;
  advisor_summary?: string | null;
  completed_at?: string | null;
  created_at: string;
  is_unlocked: boolean;
  unlocked_at?: string | null;
}

export class AssessmentService {
  private static readonly STORAGE_KEY = 'advisor_assessments';
  private static readonly FRIEND_STORAGE_KEY = 'friend_assessments';

  static generateAssessmentId(): string {
    return 'assess_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  static generateAssessmentLink(assessmentId: string): string {
    return `${window.location.origin}/assessment?advisor=${assessmentId}`;
  }

  private static async shouldFlagTrialInvite(advisorEmail: string): Promise<boolean> {
    try {
      const normalizedEmail = advisorEmail?.trim().toLowerCase();

      if (!normalizedEmail) {
        return false;
      }

      const { qualifiesForTrial, count } = await callApi<{ qualifiesForTrial: boolean; count: number }>(
        `/api/assessments/trial-eligibility?advisorEmail=${encodeURIComponent(normalizedEmail)}`
      );

      return qualifiesForTrial && (count ?? 0) === 0;
    } catch (error) {
      console.error('Unexpected error while evaluating trial eligibility:', error);
      return false;
    }
  }

  static generateFriendAssessmentId(): string {
    return 'friend_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  static generateFriendAssessmentLink(assessmentId: string): string {
    return `${window.location.origin}/assessment?share=${assessmentId}`;
  }

  static async shareAssessmentWithFriend(
    sharerName: string,
    sharerEmail: string,
    recipientEmail: string,
    relationship: string,
    sharerProfile: Profile,
    personalNote?: string,
    recipientName?: string
  ): Promise<{ success: boolean; shareId?: string; assessmentLink?: string; error?: string }> {
    let shareId: string | undefined;
    let assessmentLink: string | undefined;

    try {
      if (!sharerProfile) {
        return { success: false, error: 'Your profile is required before sharing the assessment.' };
      }

      const sharerId = getOrCreateUserId();
      const generatedShareId = this.generateFriendAssessmentId();
      const generatedAssessmentLink = this.generateFriendAssessmentLink(generatedShareId);

      shareId = generatedShareId;
      assessmentLink = generatedAssessmentLink;

      const share: FriendAssessmentShare = {
        id: generatedShareId,
        sharerId,
        sharerName,
        sharerEmail,
        recipientEmail,
        recipientName,
        relationship,
        personalNote,
        status: 'sent',
        sentAt: new Date(),
        assessmentLink: generatedAssessmentLink,
        sharerProfile
      };

      this.saveFriendAssessment(share);

      const emailSent = await EmailService.sendFriendAssessmentInvitation(
        sharerName,
        sharerEmail,
        recipientEmail,
        generatedAssessmentLink,
        relationship,
        personalNote
      );

      if (!emailSent) {
        return {
          success: false,
          shareId,
          assessmentLink,
          error: 'Failed to send invitation email'
        };
      }

      return { success: true, shareId, assessmentLink };
    } catch (error) {
      console.error('Error sharing assessment with friend:', error);
      return {
        success: false,
        shareId,
        assessmentLink,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async shareAssessment(
    advisorName: string,
    advisorEmail: string,
    clientEmail: string,
    clientName?: string
  ): Promise<{ success: boolean; assessmentId?: string; assessmentLink?: string; error?: string; qualifiesForTrial?: boolean }> {
    let assessmentId: string | undefined;
    let assessmentLink: string | undefined;

    try {
      // Verify advisor is authenticated
      const currentAdvisor = await AuthService.getCurrentAdvisor();
      const normalizedCurrentEmail = currentAdvisor?.email?.trim().toLowerCase() || '';
      const normalizedProvidedEmail = advisorEmail?.trim().toLowerCase() || '';

      if (!currentAdvisor || !normalizedCurrentEmail) {
        return { success: false, error: 'Unauthorized: Please log in again' };
      }

      if (normalizedProvidedEmail && normalizedCurrentEmail !== normalizedProvidedEmail) {
        return { success: false, error: 'Advisor email mismatch. Please refresh and try again.' };
      }

      const canonicalAdvisorEmail = normalizedCurrentEmail;
      const canonicalAdvisorName = currentAdvisor.name?.trim() || advisorName;

      const qualifiesForTrial = await this.shouldFlagTrialInvite(canonicalAdvisorEmail);

      const generatedAssessmentId = this.generateAssessmentId();
      const generatedAssessmentLink = this.generateAssessmentLink(generatedAssessmentId);

      assessmentId = generatedAssessmentId;
      assessmentLink = generatedAssessmentLink;

      // Save to database first
      await callApi('/api/assessments/create', {
        method: 'POST',
        body: JSON.stringify({
          id: generatedAssessmentId,
          advisorEmail: canonicalAdvisorEmail,
          advisorName: canonicalAdvisorName,
          clientEmail,
          clientName,
          assessmentLink: generatedAssessmentLink,
          isTrial: qualifiesForTrial,
        }),
      });

      // Also save to localStorage for backward compatibility
      const now = new Date();
      let localAssessment: AdvisorAssessment = {
        id: generatedAssessmentId,
        advisorName: canonicalAdvisorName,
        advisorEmail: canonicalAdvisorEmail,
        clientEmail,
        clientName,
        status: 'sent',
        assessmentLink: generatedAssessmentLink,
        sentAt: now,
        isTrial: qualifiesForTrial,
      };

      this.saveAssessment(localAssessment);

      // Send email invitation
      const emailSent = await EmailService.sendAssessmentInvitation(
        canonicalAdvisorName,
        canonicalAdvisorEmail,
        clientEmail,
        generatedAssessmentLink,
        clientName
      );

      if (!emailSent) {
        return {
          success: false,
          assessmentId,
          assessmentLink,
          error: 'Failed to send email invitation'
        };
      }

      try {
        await EmailService.sendInternalLeadNotification(
          canonicalAdvisorName,
          canonicalAdvisorEmail,
          clientEmail,
          generatedAssessmentLink,
          clientName
        );
      } catch (internalNotificationError) {
        console.error('Failed to send internal lead notification:', internalNotificationError);
      }

      try {
        const confirmationSent = await EmailService.sendAdvisorShareConfirmation(
          canonicalAdvisorEmail,
          canonicalAdvisorName,
          clientEmail,
          generatedAssessmentLink,
          {
            clientName,
            qualifiesForTrial,
          }
        );

        if (confirmationSent) {
          const confirmationTimestamp = new Date().toISOString();

          try {
            await callApi('/api/assessments/confirm', {
              method: 'POST',
              body: JSON.stringify({ assessmentId: generatedAssessmentId, confirmationSentAt: confirmationTimestamp }),
            });
          } catch (confirmationUpdateError) {
            console.error('Failed to record confirmation timestamp:', confirmationUpdateError);
          }

          localAssessment = {
            ...localAssessment,
            confirmationSentAt: confirmationTimestamp,
          };

          this.saveAssessment(localAssessment);
        }
      } catch (confirmationError) {
        console.error('Failed to send advisor confirmation email:', confirmationError);
      }

      return { success: true, assessmentId, assessmentLink, qualifiesForTrial };
    } catch (error) {
      console.error('Error sharing assessment:', error);
      return {
        success: false,
        assessmentId,
        assessmentLink,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  static async completeAssessment(
    assessmentId: string,
    results: Profile
  ): Promise<boolean> {
    try {
      console.log('🔄 Starting assessment completion for ID:', assessmentId);
      
      // Try to get assessment from database first, then fall back to localStorage
      let assessment = await this.getAssessmentFromDatabase(assessmentId);
      if (!assessment) {
        console.log('Assessment not found in database, checking localStorage...');
        const localAssessment = this.getAssessment(assessmentId);
        if (localAssessment) {
          assessment = {
            advisor_email: localAssessment.advisorEmail,
            advisor_name: localAssessment.advisorName,
            client_email: localAssessment.clientEmail,
            client_name: localAssessment.clientName
          };
        }
      }
      
      if (!assessment) {
        console.error('❌ Assessment not found:', assessmentId);
        throw new Error(`Assessment not found: ${assessmentId}`);
      }

      console.log('✅ Found assessment:', assessment);
      
      // Save results to Supabase database
      const assessmentAnswers = JSON.parse(localStorage.getItem('assessmentAnswers') || '[]');
      
      // Generate AI advisor summary for advisor assessments
      console.log('🤖 Generating AI advisor summary for advisor assessment...');
      let advisorSummary = '';
      try {
        advisorSummary = await generateAdvisorSummary(results, assessmentAnswers);
        console.log('✅ AI advisor summary generated successfully');
      } catch (error) {
        console.error('❌ Failed to generate AI advisor summary:', error);
        advisorSummary = 'AI advisor summary could not be generated at this time.';
      }
      
      await callApi('/api/assessment-results/complete', {
        method: 'POST',
        body: JSON.stringify({
          assessmentId,
          advisorEmail: assessment.advisor_email,
          clientEmail: assessment.client_email,
          clientName: assessment.client_name,
          answers: assessmentAnswers,
          profile: results,
          advisorSummary,
        }),
      });

      console.log('✅ Assessment results saved to database');
      
      // Update assessment status in database
      // Database status is updated within the API

      // Also update localStorage for backward compatibility
      const localAssessment = this.getAssessment(assessmentId);
      if (localAssessment) {
        const updatedAssessment: AdvisorAssessment = {
          ...localAssessment,
          status: 'completed',
          completedAt: new Date(),
          results
        };
        this.saveAssessment(updatedAssessment);
      }

      // Force a storage event to trigger dashboard refresh
      console.log('📡 Dispatching storage event for dashboard refresh');
      window.dispatchEvent(new StorageEvent('storage', {
        key: this.STORAGE_KEY,
        newValue: localStorage.getItem(this.STORAGE_KEY),
        storageArea: localStorage
      }));
      
      // Also dispatch a custom event for same-window updates
      window.dispatchEvent(new CustomEvent('localStorageUpdate'));

      // Send completion notification to advisor
      try {
        console.log('📧 Sending completion notification to advisor:', assessment.advisor_email);
        await EmailService.sendCompletionNotification(
          assessment.advisor_email,
          assessment.advisor_name,
          assessment.client_email,
          assessment.client_name
        );
        console.log('✅ Email notification sent successfully');
      } catch (emailError) {
        console.error('❌ Email notification failed (but continuing):', emailError);
        // Don't fail the whole completion if email fails
      }

      console.log('🎉 Assessment completion successful');
      return true;
    } catch (error) {
      console.error('Error completing assessment:', error);
      return false;
    }
  }

  static async completeFriendAssessment(
    assessmentId: string,
    results: Profile
  ): Promise<boolean> {
    try {
      const share = this.getFriendAssessment(assessmentId);
      if (!share) {
        throw new Error('Shared assessment not found');
      }

      const compatibility = generateCompatibilityInsights(share.sharerProfile, results);

      const updatedShare: FriendAssessmentShare = {
        ...share,
        status: 'completed',
        completedAt: new Date(),
        recipientProfile: results,
        compatibility
      };

      this.saveFriendAssessment(updatedShare);

      window.dispatchEvent(new StorageEvent('storage', {
        key: this.FRIEND_STORAGE_KEY,
        newValue: localStorage.getItem(this.FRIEND_STORAGE_KEY),
        storageArea: localStorage
      }));
      window.dispatchEvent(new CustomEvent('localStorageUpdate'));

      try {
        await EmailService.sendFriendCompletionNotification(
          share.sharerEmail,
          share.sharerName,
          share.recipientEmail,
          compatibility
        );
      } catch (error) {
        console.error('Error sending friend completion notification:', error);
      }

      return true;
    } catch (error) {
      console.error('Error completing friend assessment:', error);
      return false;
    }
  }

  static async getUnlockedAssessmentResultsForAdvisor(advisorEmail: string): Promise<DatabaseAssessmentResult[]> {
    try {
      const data = await callApi<DatabaseAssessmentResult[]>(
        `/api/assessment-results/by-advisor?advisorEmail=${encodeURIComponent(advisorEmail)}`
      );

      return data || [];
    } catch (error) {
      console.error('Error getting assessment results for advisor:', error);
      return [];
    }
  }

  // New method to get assessment from database
  static async getAssessmentFromDatabase(assessmentId: string): Promise<DatabaseAdvisorAssessment | null> {
    try {
      const data = await callApi<DatabaseAdvisorAssessment>(
        `/api/assessments/get?id=${encodeURIComponent(assessmentId)}`
      );

      return data || null;
    } catch (error) {
      console.error('Error getting assessment from database:', error);
      return null;
    }
  }

  static async deleteAssessment(assessmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await callApi('/api/assessments/delete', {
        method: 'POST',
        body: JSON.stringify({ assessmentId }),
      });

      // Delete from localStorage for backward compatibility
      const assessments = this.getAllAssessments();
      const filteredAssessments = assessments.filter(a => a.id !== assessmentId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredAssessments));

      // Trigger storage events to update UI
      window.dispatchEvent(new StorageEvent('storage', {
        key: this.STORAGE_KEY,
        newValue: localStorage.getItem(this.STORAGE_KEY),
        storageArea: localStorage
      }));
      window.dispatchEvent(new CustomEvent('localStorageUpdate'));

      return { success: true };
    } catch (error) {
      console.error('Error deleting assessment:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to delete assessment' 
      };
    }
  }

  // Update method to get assessments for advisor dashboard
  static async getAssessmentsForAdvisorFromDatabase(
    advisorEmail: string,
    advisorName?: string,
  ): Promise<DatabaseAdvisorAssessment[]> {
    try {
      const normalizedEmail = advisorEmail?.trim().toLowerCase();

      if (!normalizedEmail && !advisorName) {
        return [];
      }

      const data = await callApi<DatabaseAdvisorAssessment[]>(
        `/api/assessments/by-advisor?advisorEmail=${encodeURIComponent(normalizedEmail || '')}&advisorName=${encodeURIComponent(advisorName || '')}`
      );

      return data || [];
    } catch (error) {
      console.error('Error getting advisor assessments from database:', error);
      return [];
    }
  }

  static async getAssessmentResult(assessmentId: string): Promise<DatabaseAssessmentResult | null> {
    try {
      const data = await callApi<DatabaseAssessmentResult>(
        `/api/assessment-results/get?assessmentId=${encodeURIComponent(assessmentId)}`
      );

      return data || null;
    } catch (error) {
      console.error('Error getting assessment result:', error);
      return null;
    }
  }

  static async unlockAssessment(assessmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const advisor = await AuthService.getCurrentAdvisor();
      const advisorEmail = advisor?.email;

      if (!advisorEmail) {
        return { success: false, error: 'Authentication required' };
      }

      // Check if this is a trial assessment
      const assessment = await this.getAssessmentFromDatabase(assessmentId);

      if (assessment?.is_trial) {
        console.log('Trial assessment detected, unlocking without payment:', assessmentId);
        return await this.forceUnlockAssessment(assessmentId);
      }

      // Not a trial, proceed with Stripe checkout
      await stripeService.redirectToCheckout({
        assessmentId,
        advisorEmail,
        successUrl: `${window.location.origin}/advisor/dashboard?payment=success`,
        cancelUrl: `${window.location.origin}/advisor/dashboard?payment=cancelled`,
      });

      return { success: true };
    } catch (error) {
      console.error('Error unlocking assessment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlock assessment'
      };
    }
  }

  static async forceUnlockAssessment(assessmentId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const now = new Date().toISOString();

      // Update advisor_assessments table
      await callApi('/api/assessment-results/unlock', {
        method: 'POST',
        body: JSON.stringify({ assessmentId }),
      });

      console.log('✅ Assessment unlocked successfully:', assessmentId);
      return { success: true };
    } catch (error) {
      console.error('Error unlocking assessment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unlock assessment'
      };
    }
  }

  static getAssessment(assessmentId: string): AdvisorAssessment | null {
    try {
      const assessments = this.getAllAssessments();
      console.log('Looking for assessment ID:', assessmentId, 'in assessments:', assessments.map(a => a.id));
      return assessments.find(a => a.id === assessmentId) || null;
    } catch (error) {
      console.error('Error getting assessment:', error);
      return null;
    }
  }

  static getAllAssessments(): AdvisorAssessment[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      const assessments = stored ? JSON.parse(stored) : [];
      console.log('getAllAssessments returning:', assessments);
      return assessments;
    } catch (error) {
      console.error('Error getting assessments:', error);
      return [];
    }
  }

  private static getAllFriendAssessments(): FriendAssessmentShare[] {
    try {
      const stored = localStorage.getItem(this.FRIEND_STORAGE_KEY);
      const assessments = stored ? JSON.parse(stored) : [];
      return assessments.map((assessment: FriendAssessmentShare) => ({
        ...assessment,
        sentAt: assessment.sentAt ? new Date(assessment.sentAt) : undefined,
        completedAt: assessment.completedAt ? new Date(assessment.completedAt) : undefined
      }));
    } catch (error) {
      console.error('Error getting friend assessments:', error);
      return [];
    }
  }

  static saveAssessment(assessment: AdvisorAssessment): void {
    try {
      const assessments = this.getAllAssessments();
      const existingIndex = assessments.findIndex(a => a.id === assessment.id);
      
      if (existingIndex >= 0) {
        assessments[existingIndex] = assessment;
        console.log('📝 Updated existing assessment at index:', existingIndex, assessment);
      } else {
        assessments.push(assessment);
        console.log('➕ Added new assessment, total count:', assessments.length, assessment);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(assessments));
      console.log('💾 Saved assessments to localStorage - total:', assessments.length);
      
      // Verify the save worked
      const verified = localStorage.getItem(this.STORAGE_KEY);
      if (verified) {
        const parsedVerification = JSON.parse(verified);
        console.log('✅ Save verification successful - count:', parsedVerification.length);
      } else {
        console.error('❌ Save verification failed - no data in localStorage');
      }
    } catch (error) {
      console.error('Error saving assessment:', error);
    }
  }

  private static saveFriendAssessment(assessment: FriendAssessmentShare): void {
    try {
      const assessments = this.getAllFriendAssessments();
      const existingIndex = assessments.findIndex(a => a.id === assessment.id);

      if (existingIndex >= 0) {
        assessments[existingIndex] = assessment;
      } else {
        assessments.push(assessment);
      }

      localStorage.setItem(this.FRIEND_STORAGE_KEY, JSON.stringify(assessments));
    } catch (error) {
      console.error('Error saving friend assessment:', error);
    }
  }

  static getAssessmentsForAdvisor(advisorEmail: string): AdvisorAssessment[] {
    try {
      const assessments = this.getAllAssessments();
      console.log('Getting assessments for advisor:', advisorEmail);
      console.log('All assessments:', assessments);
      const filtered = assessments.filter(a => a.advisorEmail === advisorEmail);
      console.log('Filtered assessments for advisor:', filtered);
      return filtered;
    } catch (error) {
      console.error('Error getting advisor assessments:', error);
      return [];
    }
  }

  static getFriendAssessmentsForUser(): FriendAssessmentShare[] {
    try {
      const sharerId = getOrCreateUserId();
      const assessments = this.getAllFriendAssessments();
      return assessments.filter(a => a.sharerId === sharerId);
    } catch (error) {
      console.error('Error getting friend assessments for user:', error);
      return [];
    }
  }

  static getFriendAssessment(assessmentId: string): FriendAssessmentShare | null {
    try {
      const assessments = this.getAllFriendAssessments();
      return assessments.find(a => a.id === assessmentId) || null;
    } catch (error) {
      console.error('Error getting friend assessment:', error);
      return null;
    }
  }
}