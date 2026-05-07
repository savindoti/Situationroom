export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'LOCAL_USER';

export interface AppUser {
  uid: string;
  email: string;
  username: string | null;
  role: UserRole;
  createdAt: number;
  lastLogin: number;
  isDisabled?: boolean;
}

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
  ownerEmail?: string;
  ownerName?: string;
  uploadedByEmail?: string;
  lastUpdatedByEmail?: string;
  lastUpdatedTimestamp?: number;
}

export type RiskType = 'Low' | 'Medium' | 'High';

export interface RiskArea {
  id: string;
  province: string;
  district: string;
  municipal: string; // Municipal Level
  wardNumber: string;
  disasterLocation: string;
  lat: number;
  lng: number;
  typeOfDisaster: string;
  riskType: RiskType;
  exposure: string; // Exposure/Possible Impact/Risk Assessment
  previousDamageDetails: string; // Details of Damage from previous Incident
  preparednessActions: string; // Preparedness Actions Required for Possible Risk Reduction
  remarks: string;
  uploadedAt: number;
  uploaderId: string;
  uploadedByEmail?: string;
  lastUpdatedByEmail?: string;
  lastUpdatedTimestamp?: number;
}
