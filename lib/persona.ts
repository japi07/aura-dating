/**
 * Persona ID verification — hosted Inquiry flow.
 *
 * We open Persona's hosted verification in the browser, tagged with the
 * Supabase user id as the `reference-id`. Persona runs the ID + selfie check,
 * then fires a webhook (persona-webhook Edge Function) that flips the user's
 * verification_status. The app just refreshes the profile afterwards.
 *
 * This keeps the integration native-module-free (no rebuild needed). When you
 * have your Persona account:
 *   1. Create an Inquiry Template, copy its template id (itmpl_...).
 *   2. Put it in app.json → extra.personaTemplateId (+ environment id).
 *   3. Set the webhook to the persona-webhook function + its secret.
 */
import { Linking } from 'react-native';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  personaTemplateId?: string;
  personaEnvironmentId?: string;
};

const TEMPLATE_ID = extra.personaTemplateId || '';
const ENVIRONMENT_ID = extra.personaEnvironmentId || 'production';

/** True once a Persona template is configured in app.json. */
export const personaConfigured = !!TEMPLATE_ID;

/** Build the hosted inquiry URL for a given user. */
export function buildPersonaUrl(userId: string): string {
  const params = new URLSearchParams({
    'inquiry-template-id': TEMPLATE_ID,
    'reference-id': userId,
    'redirect-uri': 'auradating://verify-complete',
  });
  // environment-id is optional; include it when provided
  if (ENVIRONMENT_ID && ENVIRONMENT_ID !== 'production') {
    params.set('environment-id', ENVIRONMENT_ID);
  }
  return `https://withpersona.com/verify?${params.toString()}`;
}

/**
 * Launch the Persona hosted verification flow. Returns false if Persona isn't
 * configured (caller should fall back to the manual selfie+liveness flow).
 */
export async function startPersonaVerification(userId: string): Promise<boolean> {
  if (!personaConfigured) return false;
  await Linking.openURL(buildPersonaUrl(userId));
  return true;
}
