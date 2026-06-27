export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Onboarding: undefined;
  Main: undefined;
  Chat: { initialQuery?: string; scannedCardBase64?: string; documentId?: string };
  Voice: undefined;
  Settings: undefined;
  BusinessCard: {
    origin?: 'chat';
    editContactId?: string;
    editContactData?: {
      name: string;
      designation?: string;
      organization?: string;
      email?: string;
      phone?: string;
      address?: string;
      notes?: string;
    };
  } | undefined;
  ContactProfile: { contactId: string };
  Documents: undefined;
  DocumentDetail: { documentId: string };
};

export type TabParamList = {
  Home: undefined;
  Memory: undefined;
  _Spacer: undefined;
  Finance: undefined;
  Circles: undefined;
};
