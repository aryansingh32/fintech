export type AuthStackParamList = {
  MobileLogin: undefined;
  OtpVerify: { mobile: string; devOtp?: string };
  CreatePin: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Loans: undefined;
  Payments: undefined;
  Support: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  LoanDetail: { loanId: string };
  PayEmi: { loanId: string; suggestedAmount: string };
  ReceiptDetail: { receiptId: string };
  SupportChat: { ticketId: string };
  Notifications: undefined;
  KycStatus: undefined;
  SecurityDevices: undefined;
  Terms: undefined;
};
