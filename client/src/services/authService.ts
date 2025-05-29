import { RegistrationResult } from '@/types/auth';

export const registerUserWithTelegram = async (
  guestId: string,
  referrerCode: string | null | undefined
): Promise<RegistrationResult> => {
  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        guest_id: guestId,
        referrer_code: referrerCode || null,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      success: true,
      data: {
        user_id: data.user_id,
      },
    };
  } catch (error) {
    console.error('Error registering user:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}; 