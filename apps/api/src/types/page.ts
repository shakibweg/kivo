export interface ApiPage {
  id: string;
  userId?: string | null;
  parentId?: string | null;
  title: string;
  icon?: string | null;
  coverImage?: string | null;
  quote?: string | null;
  content?: string | null;
  children?: ApiPage[];
  createdAt?: string;
  updatedAt?: string;
}
