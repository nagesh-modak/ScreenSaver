import type { PrivacyReport } from '../../shared/types';

const rules: Array<{
  type: PrivacyReport['redactions'][number]['type'];
  pattern: RegExp;
  replacement: string;
}> = [
  {
    type: 'email',
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replacement: '[REDACTED_EMAIL]'
  },
  {
    type: 'phone',
    pattern: /(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g,
    replacement: '[REDACTED_PHONE]'
  },
  {
    type: 'otp',
    pattern: /\b(?:otp|code|verification code|passcode)\D{0,12}\d{4,8}\b/gi,
    replacement: '[REDACTED_OTP]'
  },
  {
    type: 'credit_card',
    pattern: /\b(?:\d[ -]*?){13,19}\b/g,
    replacement: '[REDACTED_CARD]'
  },
  {
    type: 'api_key',
    pattern: /\b(?:sk|pk|AIza|ghp|xoxb|xapp)[A-Za-z0-9_-]{16,}\b/g,
    replacement: '[REDACTED_KEY]'
  },
  {
    type: 'url_token',
    pattern: /([?&](?:token|key|secret|code)=)[^&\s]+/gi,
    replacement: '$1[REDACTED]'
  }
];

export function redactSensitiveText(text: string): PrivacyReport {
  let redactedText = text;
  const redactions: PrivacyReport['redactions'] = [];

  for (const rule of rules) {
    const matches = redactedText.match(rule.pattern);
    if (matches?.length) {
      redactions.push({ type: rule.type, count: matches.length });
      redactedText = redactedText.replace(rule.pattern, rule.replacement);
    }
  }

  return { redactedText, redactions };
}
