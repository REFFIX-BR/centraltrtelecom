export type InvoiceStatus = 'paid' | 'open' | 'overdue';

export type Invoice = {
  id: string;
  reference: string;
  monthLabel: string;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  barcode: string;
  pixCode: string;
  issuedAt: string;
  pdfUrl?: string;
  paidAt?: string;
  clientCode?: string;
};

export type PlanInfo = {
  name: string;
  speedMbps: number;
  uploadMbps: number;
  price: number;
  status: 'active' | 'blocked' | 'pending';
  contractId: string;
  installationAddress: string;
  services: { id: string; title: string; description: string; icon: string }[];
};

export type SupportTicket = {
  id: string;
  protocol: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
  description: string;
};

export type DocumentItem = {
  id: string;
  title: string;
  type: string;
  uploadedAt: string;
  status: 'approved' | 'pending' | 'rejected';
};

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type AddressParts = {
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  complemento?: string;
};

export type Subscriber = {
  id: string;
  login: string;
  name: string;
  firstName: string;
  document: string;
  email: string;
  phone: string;
  address: string;
  addressParts?: AddressParts;
  birthDate: string;
  plan: PlanInfo;
  invoices: Invoice[];
  tickets: SupportTicket[];
  documents: DocumentItem[];
  notifications: NotificationItem[];
};
