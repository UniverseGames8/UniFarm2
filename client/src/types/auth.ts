export interface RegistrationResult {
  success: boolean;
  data?: {
    user_id: string;
  };
  error?: string;
} 