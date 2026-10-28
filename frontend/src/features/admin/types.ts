export type PermissionLevel = 1 | 2 | 3

export interface AdminUser {
  username: string
  name: string
  level: PermissionLevel
}

export interface CreateUserInput {
  username: string
  name: string
  level: PermissionLevel
  password: string
}

export interface ResetPasswordInput {
  password: string
}
