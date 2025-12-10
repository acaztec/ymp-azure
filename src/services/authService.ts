import { callApi } from '../utils/apiClient'

const ADVISOR_STORAGE_KEY = 'advisor_profile'
const ADVISOR_SESSION_KEY = 'advisor_session'

export interface Advisor {
  id: string
  email: string
  name: string
  company?: string | null
  user_id: string
  created_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupData {
  email: string
  password: string
  name: string
  company?: string
}

export class AuthService {
  private static normalizeAdvisor(advisor: Advisor): Advisor {
    const normalizedEmail = advisor.email?.trim().toLowerCase() || advisor.email
    return {
      ...advisor,
      email: normalizedEmail,
      user_id: advisor.user_id || advisor.id,
    }
  }

  private static storeSession(user: { id: string; email: string }) {
    try {
      localStorage.setItem(ADVISOR_SESSION_KEY, JSON.stringify(user))
    } catch (err) {
      console.error('Failed to store session:', err)
    }
  }

  private static getStoredSession(): { id: string; email: string } | null {
    try {
      const data = localStorage.getItem(ADVISOR_SESSION_KEY)
      if (!data) return null
      const parsed = JSON.parse(data)
      return parsed?.id && parsed?.email ? parsed : null
    } catch {
      return null
    }
  }

  static storeAdvisorProfile(advisor: Advisor) {
    try {
      const sanitizedAdvisor = this.normalizeAdvisor(advisor)
      localStorage.setItem(ADVISOR_STORAGE_KEY, JSON.stringify(sanitizedAdvisor))
      if (sanitizedAdvisor?.user_id && sanitizedAdvisor?.email) {
        this.storeSession({ id: sanitizedAdvisor.user_id, email: sanitizedAdvisor.email })
      }
    } catch (err) {
      console.error('Failed to store advisor profile:', err)
    }
  }

  static getStoredAdvisorProfile(): Advisor | null {
    try {
      const data = localStorage.getItem(ADVISOR_STORAGE_KEY)
      if (!data) {
        return null
      }

      const parsed = JSON.parse(data) as Advisor
      if (!parsed.email) {
        return parsed
      }

      const normalizedEmail = parsed.email.trim().toLowerCase()
      if (normalizedEmail === parsed.email) {
        return parsed
      }

      const normalizedAdvisor = { ...parsed, email: normalizedEmail }
      this.storeAdvisorProfile(normalizedAdvisor)
      return normalizedAdvisor
    } catch {
      return null
    }
  }

  static clearStoredAdvisorProfile() {
    try {
      localStorage.removeItem(ADVISOR_STORAGE_KEY)
      localStorage.removeItem(ADVISOR_SESSION_KEY)
    } catch {
      // ignore
    }
  }

  static async login(credentials: LoginCredentials): Promise<{
    success: boolean
    advisor?: Advisor
    error?: string
  }> {
    try {
      const response = await callApi<{ advisor?: Advisor }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: credentials.email?.trim().toLowerCase(),
          password: credentials.password,
        })
      })

      if (!response?.advisor) {
        throw new Error('Login response did not include an advisor profile.')
      }

      const advisor = this.normalizeAdvisor(response.advisor)
      this.storeAdvisorProfile(advisor)

      return { success: true, advisor }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to log in' }
    }
  }

  static async signup(data: SignupData): Promise<{
    success: boolean
    advisor?: Advisor
    error?: string
  }> {
    try {
      const response = await callApi<{ advisor?: Advisor }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: data.email?.trim().toLowerCase(),
          password: data.password,
          name: data.name,
          company: data.company,
        })
      })

      if (!response?.advisor) {
        throw new Error('Signup response did not include an advisor profile.')
      }

      const advisor = this.normalizeAdvisor(response.advisor)
      this.storeAdvisorProfile(advisor)
      return { success: true, advisor }
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to sign up' }
    }
  }

  static async resendConfirmationEmail(_email: string): Promise<{
    success: boolean
    error?: string
  }> {
    return { success: true }
  }

  static async logout(): Promise<void> {
    this.clearStoredAdvisorProfile()
  }

  static async getCurrentUser(): Promise<{ id: string; email: string } | null> {
    const session = this.getStoredSession()
    if (session?.id && session?.email) {
      return session
    }

    const advisor = this.getStoredAdvisorProfile()
    if (!advisor?.user_id || !advisor?.email) return null

    const normalizedAdvisor = this.normalizeAdvisor(advisor)
    this.storeAdvisorProfile(normalizedAdvisor)
    return { id: normalizedAdvisor.user_id, email: normalizedAdvisor.email }
  }

  static async getSession() {
    const user = await this.getCurrentUser()
    return { data: { session: user ? { user } : null }, error: null }
  }

  static async getCurrentAdvisor(): Promise<Advisor | null> {
    try {
      const advisor = this.getStoredAdvisorProfile()
      if (advisor) {
        const normalized = this.normalizeAdvisor(advisor)
        this.storeAdvisorProfile(normalized)
        return normalized
      }

      const session = this.getStoredSession()
      if (session?.id) {
        const profile = await this.getAdvisorProfile(session.id)
        return profile ? this.normalizeAdvisor(profile) : null
      }

      return null
    } catch (error) {
      console.error('Error getting current advisor:', error)
      return null
    }
  }

  static async isAuthenticated(): Promise<boolean> {
    const { data } = await this.getSession()
    return !!data.session
  }

  static async getAdvisorProfile(_userId: string): Promise<Advisor | null> {
    if (!_userId) return null

    try {
      const response = await callApi<{ advisor: Advisor }>(`/api/auth/profile?userId=${encodeURIComponent(_userId)}`)
      return this.normalizeAdvisor(response.advisor)
    } catch (error) {
      console.error('Error fetching advisor profile:', error)
      return null
    }
  }

  static async getAdvisorById(advisorId: string): Promise<Advisor | null> {
    if (!advisorId) return null

    const advisor = this.getStoredAdvisorProfile()
    if (advisor && advisor.id === advisorId) return this.normalizeAdvisor(advisor)

    try {
      const profile = await this.getAdvisorProfile(advisorId)
      return profile ? this.normalizeAdvisor(profile) : null
    } catch (error) {
      console.error('Error fetching advisor by id:', error)
      return null
    }
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (event: any, session: any) => void) {
    const session = this.getStoredSession()
    const advisor = this.getStoredAdvisorProfile()
    const user = session || (advisor ? { id: advisor.user_id, email: advisor.email } : null)
    callback('INITIAL', { user })
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            // No-op for local auth implementation
          }
        }
      },
      error: null
    }
  }
}
