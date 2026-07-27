export type AuthUser = {
  id: string | number;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
};

export type LoginResponse = {
  message: string;
  token: string;
  user: AuthUser;
};
