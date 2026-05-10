export interface AdminUser {
  id: string;
  login: string;
  password: string;
  name: string;
}

export interface FolderRecord {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkRecord {
  id: string;
  folderId: string;
  title: string;
  imageUrl: string;
  details: Array<{
    key: string;
    value: string;
  }>;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  token: string;
  userId: string;
  createdAt: string;
}

export interface DatabaseRecord {
  users: AdminUser[];
  sessions: SessionRecord[];
  folders: FolderRecord[];
  works: WorkRecord[];
}

export interface PublicFolder {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string;
  sortOrder: number;
  worksCount: number;
}

export interface PublicWork {
  id: string;
  title: string;
  imageUrl: string;
  details: Array<{
    key: string;
    value: string;
  }>;
  sortOrder: number;
}

export interface PublicFolderDetails extends PublicFolder {
  works: PublicWork[];
}

export interface AuthPayload {
  token: string;
  user: {
    id: string;
    login: string;
    name: string;
  };
}
