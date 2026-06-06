import { http, ApiSuccess } from './http';

export type LoginRequest = {
  email: string;
  password: string;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type LoginResponse = {
  token: string;
  user: User;
};

export type RegisterRequest = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'municipal_officer' | 'supervisor' | 'collector';
  phone?: string;
};

export async function loginApi(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await http.post<ApiSuccess<LoginResponse>>('/auth/login', payload);
  return data.data;
}

export async function registerApi(payload: RegisterRequest): Promise<LoginResponse> {
  const { data } = await http.post<ApiSuccess<LoginResponse>>('/auth/register', payload);
  return data.data;
}

export async function meApi(): Promise<User> {
  const { data } = await http.get<ApiSuccess<User>>('/auth/me');
  return data.data;
}

export type UpdateProfileRequest = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: string;
};

export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export async function updateProfileApi(payload: UpdateProfileRequest): Promise<User> {
  const { data } = await http.put<ApiSuccess<User>>('/auth/profile', payload);
  return data.data;
}

export async function changePasswordApi(payload: ChangePasswordRequest): Promise<void> {
  await http.put<ApiSuccess<null>>('/auth/change-password', payload);
}











