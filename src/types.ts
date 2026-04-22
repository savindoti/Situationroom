export type SupportStatus = 'Pending' | 'Ongoing' | 'Resolved';

export interface SupportTask {
  id: string;
  date: string;
  province: string;
  district: string;
  municipal: string;
  details: string;
  organization: string;
  contactPerson: string;
  contactNumber: string;
  status: SupportStatus;
  createdAt: number;
  updatedAt: number;
  ownerId: string;
}
