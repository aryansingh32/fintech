/**
 * Every notification the platform sends maps to one of these events
 * (blueprint #11, #21, #38). Each event has a template per supported
 * locale; `render` fills `{{placeholders}}` with the payload's values.
 * Adding a language later means adding a key here, not touching call sites.
 */
export enum NotificationEvent {
  EMI_APPROACHING = 'EMI_APPROACHING',
  EMI_DUE = 'EMI_DUE',
  EMI_OVERDUE = 'EMI_OVERDUE',
  PAYMENT_CONFIRMED = 'PAYMENT_CONFIRMED',
  RECEIPT_GENERATED = 'RECEIPT_GENERATED',
  LOAN_APPROVED = 'LOAN_APPROVED',
  LOAN_REJECTED = 'LOAN_REJECTED',
  LOAN_CANCELLED = 'LOAN_CANCELLED',
  AGREEMENT_AVAILABLE = 'AGREEMENT_AVAILABLE',
  SUPPORT_REPLY = 'SUPPORT_REPLY',
  SUPPORT_MESSAGE_RECEIVED = 'SUPPORT_MESSAGE_RECEIVED',
  SUPPORT_TICKET_APPROVED = 'SUPPORT_TICKET_APPROVED',
  SUPPORT_TICKET_CLOSED = 'SUPPORT_TICKET_CLOSED',
  SECURITY_ALERT = 'SECURITY_ALERT',
  PAYMENT_REVERSED = 'PAYMENT_REVERSED',
  EMI_RESCHEDULED = 'EMI_RESCHEDULED',
  KYC_VERIFIED = 'KYC_VERIFIED',
  KYC_REJECTED = 'KYC_REJECTED',
  PENALTY_APPLIED = 'PENALTY_APPLIED',
  PAYMENT_RECEIVED_STAFF = 'PAYMENT_RECEIVED_STAFF',
}

export type SupportedLocale = 'en' | 'hi';

export interface NotificationTemplate {
  title: Record<SupportedLocale, string>;
  body: Record<SupportedLocale, string>;
}

export const NOTIFICATION_TEMPLATES: Record<NotificationEvent, NotificationTemplate> = {
  [NotificationEvent.EMI_APPROACHING]: {
    title: { en: 'EMI due soon', hi: 'EMI जल्द देय है' },
    body: {
      en: 'Your EMI of ₹{{amount}} for {{loanNumber}} is due on {{dueDate}}.',
      hi: '{{loanNumber}} की आपकी EMI ₹{{amount}} {{dueDate}} को देय है।',
    },
  },
  [NotificationEvent.EMI_DUE]: {
    title: { en: 'EMI due today', hi: 'EMI आज देय है' },
    body: {
      en: 'Your EMI of ₹{{amount}} for {{loanNumber}} is due today.',
      hi: '{{loanNumber}} की आपकी EMI ₹{{amount}} आज देय है।',
    },
  },
  [NotificationEvent.EMI_OVERDUE]: {
    title: { en: 'EMI overdue', hi: 'EMI बकाया है' },
    body: {
      en: 'Your EMI of ₹{{amount}} for {{loanNumber}} is overdue. Please pay at the earliest.',
      hi: '{{loanNumber}} की आपकी EMI ₹{{amount}} बकाया है। कृपया जल्द भुगतान करें।',
    },
  },
  [NotificationEvent.PAYMENT_CONFIRMED]: {
    title: { en: 'Payment received', hi: 'भुगतान प्राप्त हुआ' },
    body: {
      en: 'We received your payment of ₹{{amount}} for {{loanNumber}}. Thank you!',
      hi: '{{loanNumber}} के लिए आपका ₹{{amount}} का भुगतान प्राप्त हुआ। धन्यवाद!',
    },
  },
  [NotificationEvent.RECEIPT_GENERATED]: {
    title: { en: 'Receipt ready', hi: 'रसीद तैयार है' },
    body: {
      en: 'Receipt {{receiptNumber}} for ₹{{amount}} is now available.',
      hi: 'रसीद {{receiptNumber}} (₹{{amount}}) अब उपलब्ध है।',
    },
  },
  [NotificationEvent.LOAN_APPROVED]: {
    title: { en: 'Loan approved', hi: 'लोन स्वीकृत' },
    body: {
      en: 'Your loan {{loanNumber}} has been approved. View your EMI schedule in the app.',
      hi: 'आपका लोन {{loanNumber}} स्वीकृत हो गया है। ऐप में अपनी EMI अनुसूची देखें।',
    },
  },
  [NotificationEvent.LOAN_REJECTED]: {
    title: { en: 'Loan application update', hi: 'लोन आवेदन अपडेट' },
    body: {
      en: 'Your loan application {{loanNumber}} could not be approved at this time.',
      hi: 'आपका लोन आवेदन {{loanNumber}} इस समय स्वीकृत नहीं हो सका।',
    },
  },
  [NotificationEvent.LOAN_CANCELLED]: {
    title: { en: 'Loan cancelled', hi: 'लोन रद्द' },
    body: { en: 'Your loan {{loanNumber}} has been cancelled.', hi: 'आपका लोन {{loanNumber}} रद्द कर दिया गया है।' },
  },
  [NotificationEvent.AGREEMENT_AVAILABLE]: {
    title: { en: 'Agreement available', hi: 'अनुबंध उपलब्ध' },
    body: {
      en: 'The agreement for loan {{loanNumber}} is ready to view.',
      hi: 'लोन {{loanNumber}} का अनुबंध देखने के लिए तैयार है।',
    },
  },
  [NotificationEvent.SUPPORT_REPLY]: {
    title: { en: 'Support replied', hi: 'सहायता का जवाब' },
    body: { en: 'You have a new reply on ticket {{ticketNumber}}.', hi: 'टिकट {{ticketNumber}} पर नया जवाब आया है।' },
  },
  [NotificationEvent.SUPPORT_MESSAGE_RECEIVED]: {
    title: { en: 'New support message', hi: 'नया सहायता संदेश' },
    body: { en: 'New message on ticket {{ticketNumber}}.', hi: 'टिकट {{ticketNumber}} पर नया संदेश।' },
  },
  [NotificationEvent.SUPPORT_TICKET_APPROVED]: {
    title: { en: 'Chat opened', hi: 'चैट शुरू हुई' },
    body: {
      en: 'Your ticket {{ticketNumber}} was approved - you can chat with us now.',
      hi: 'आपका टिकट {{ticketNumber}} स्वीकृत हो गया है - अब आप हमसे चैट कर सकते हैं।',
    },
  },
  [NotificationEvent.SUPPORT_TICKET_CLOSED]: {
    title: { en: 'Chat closed', hi: 'चैट बंद हुई' },
    body: {
      en: 'Your conversation on ticket {{ticketNumber}} has been closed.',
      hi: 'टिकट {{ticketNumber}} पर आपकी बातचीत बंद कर दी गई है।',
    },
  },
  [NotificationEvent.SECURITY_ALERT]: {
    title: { en: 'Security alert', hi: 'सुरक्षा चेतावनी' },
    body: { en: '{{message}}', hi: '{{message}}' },
  },
  [NotificationEvent.PAYMENT_REVERSED]: {
    title: { en: 'Payment reversed', hi: 'भुगतान वापस लिया गया' },
    body: {
      en: 'Your payment of ₹{{amount}} for {{loanNumber}} was reversed: {{reason}}.',
      hi: '{{loanNumber}} के लिए आपका ₹{{amount}} का भुगतान वापस लिया गया: {{reason}}।',
    },
  },
  [NotificationEvent.EMI_RESCHEDULED]: {
    title: { en: 'EMI date updated', hi: 'EMI तिथि अपडेट की गई' },
    body: {
      en: 'Your EMI for {{loanNumber}} has been moved to {{dueDate}}.',
      hi: '{{loanNumber}} की आपकी EMI {{dueDate}} पर स्थानांतरित कर दी गई है।',
    },
  },
  [NotificationEvent.KYC_VERIFIED]: {
    title: { en: 'KYC verified', hi: 'KYC सत्यापित' },
    body: {
      en: 'Your {{documentType}} has been verified. Your KYC is now complete.',
      hi: 'आपका {{documentType}} सत्यापित हो गया है। आपका KYC अब पूर्ण है।',
    },
  },
  [NotificationEvent.PAYMENT_RECEIVED_STAFF]: {
    title: { en: 'Online payment received', hi: 'ऑनलाइन भुगतान प्राप्त हुआ' },
    body: {
      en: 'A customer paid ₹{{amount}} online for {{loanNumber}}.',
      hi: 'एक ग्राहक ने {{loanNumber}} के लिए ऑनलाइन ₹{{amount}} का भुगतान किया।',
    },
  },
  [NotificationEvent.PENALTY_APPLIED]: {
    title: { en: 'Late payment penalty added', hi: 'विलंब शुल्क जोड़ा गया' },
    body: {
      en: 'A penalty of ₹{{amount}} was added to EMI {{sequence}} of {{loanNumber}} for late payment.',
      hi: '{{loanNumber}} की EMI {{sequence}} पर देरी से भुगतान के लिए ₹{{amount}} का विलंब शुल्क जोड़ा गया।',
    },
  },
  [NotificationEvent.KYC_REJECTED]: {
    title: { en: 'KYC document rejected', hi: 'KYC दस्तावेज़ अस्वीकृत' },
    body: {
      en: 'Your {{documentType}} could not be verified: {{reason}}. Please visit your SPTC Finance store.',
      hi: 'आपका {{documentType}} सत्यापित नहीं हो सका: {{reason}}। कृपया अपने SPTC Finance स्टोर पर जाएं।',
    },
  },
};

export function renderTemplate(
  event: NotificationEvent,
  locale: SupportedLocale,
  payload: Record<string, string | number>,
): { title: string; body: string } {
  const template = NOTIFICATION_TEMPLATES[event];
  const fill = (text: string) =>
    text.replace(/{{(.*?)}}/g, (_, key: string) => String(payload[key.trim()] ?? ''));
  return { title: fill(template.title[locale]), body: fill(template.body[locale]) };
}
