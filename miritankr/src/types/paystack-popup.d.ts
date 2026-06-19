interface PaystackPopOptions {
  key: string;
  email: string;
  amount: number; // in kobo
  ref: string;
  currency?: string;
  callback?: (response: { reference: string; status: string }) => void;
  onClose?: () => void;
}

interface PaystackPop {
  setup: (options: PaystackPopOptions) => {
    openIframe: () => void;
  };
}

interface Window {
  PaystackPop?: PaystackPop;
}
