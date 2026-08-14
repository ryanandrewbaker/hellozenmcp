import type { AuthorizationServerMetadata } from './discovery.js';

const REQUIRED_RESPONSE_TYPE = 'code';
const REQUIRED_CODE_CHALLENGE = 'S256';
const REQUIRED_GRANT_TYPE = 'authorization_code';

export function validateRequiredAuthorizationServerCapabilities(
  metadata: AuthorizationServerMetadata,
): void {
  if (!metadata.response_types_supported) {
    throw new Error(
      'Authorization server metadata must include response_types_supported with "code" for authorization code flow',
    );
  }

  if (!metadata.response_types_supported.includes(REQUIRED_RESPONSE_TYPE)) {
    throw new Error(
      `Authorization server does not support response_type "${REQUIRED_RESPONSE_TYPE}"`,
    );
  }

  if (!metadata.code_challenge_methods_supported) {
    throw new Error(
      'Authorization server metadata must include code_challenge_methods_supported with "S256" for PKCE',
    );
  }

  if (!metadata.code_challenge_methods_supported.includes(REQUIRED_CODE_CHALLENGE)) {
    throw new Error(
      `Authorization server does not support PKCE method "${REQUIRED_CODE_CHALLENGE}"`,
    );
  }

  if (metadata.grant_types_supported) {
    if (!metadata.grant_types_supported.includes(REQUIRED_GRANT_TYPE)) {
      throw new Error(
        `Authorization server does not support grant_type "${REQUIRED_GRANT_TYPE}"`,
      );
    }
  }
}
