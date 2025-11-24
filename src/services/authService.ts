import { v4 as uuid } from 'uuid'

const ADVISOR_STORAGE_KEY = 'advisor_profile'

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
  static storeAdvisorProfile(advisor: Advisor) {
    try {
      const sanitizedAdvisor: Advisor = {
        ...advisor,
        email: advisor.email?.trim().toLowerCase() || advisor.email,
      }
      localStorage.setItem(ADVISOR_STORAGE_KEY, JSON.stringify(sanitizedAdvisor))
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
    } catch {
      // ignore
    }
  }

  static async login(credentials: LoginCredentials): Promise<{
    success: boolean
    advisor?: Advisor
    error?: string
  }> {
    const stored = this.getStoredAdvisorProfile()
    const email = credentials.email?.trim().toLowerCase()

    if (stored && stored.email === email) {
      return { success: true, advisor: stored }
    }

    return { success: false, error: 'Account not found. Please sign up first.' }
  }

  static async signup(data: SignupData): Promise<{
    success: boolean
    advisor?: Advisor
    error?: string
  }> {
    const now = new Date().toISOString()
    const advisor: Advisor = {
      id: uuid(),
      user_id: uuid(),
      email: data.email.trim().toLowerCase(),
      name: data.name,
      company: data.company || null,
      created_at: now,
    }

    this.storeAdvisorProfile(advisor)
    return { success: true, advisor }
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
    const advisor = this.getStoredAdvisorProfile()
    if (!advisor) return null
    return { id: advisor.user_id, email: advisor.email }
  }

  static async getSession() {
    const user = await this.getCurrentUser()
    return { data: { session: user ? { user } : null }, error: null }
  }

  static async getCurrentAdvisor(): Promise<Advisor | null> {
    try {
      const advisor = this.getStoredAdvisorProfile()
      return advisor || null
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
    return this.getStoredAdvisorProfile()
  }

  static async getAdvisorById(advisorId: string): Promise<Advisor | null> {
    const advisor = this.getStoredAdvisorProfile()
    if (advisor && advisor.id === advisorId) return advisor
    return null
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (event: any, session: any) => void) {
    const advisor = this.getStoredAdvisorProfile()
    const user = advisor ? { id: advisor.user_id, email: advisor.email } : null
    callback('INITIAL', { user })
    return { data: null, error: null }
  }
}
