export type AuthStackParamList = {
  StaffLogin: undefined;
  DeviceVerify: { mobile: string; devOtp?: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Customers: undefined;
  Loans: undefined;
  Collections: undefined;
  More: undefined;
};

export type RootStackParamList = {
  Main: undefined;
  GlobalSearch: undefined;
  CustomerProfile: { customerId: string };
  EditCustomer: { customerId: string };
  CreateCustomer: undefined;
  CreateLoan: { customerId: string };
  LoanDetail: { loanId: string };
  CollectPayment: { loanId: string; suggestedAmount?: string };
  CustomerReceipts: { customerId: string };
  CustomerLedger: { customerId: string };
  ReceiptDetail: { receiptId: string };
  AuditLog: undefined;
  SupportList: undefined;
  SupportChat: { ticketId: string };
  Reports: undefined;
  LoanProductsAdmin: undefined;
  AgreementTemplatesAdmin: undefined;
  StaffManagement: undefined;
  Profile: undefined;
  SecurityDevices: undefined;
  Notifications: undefined;
};
