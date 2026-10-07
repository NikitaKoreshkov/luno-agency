import bcrypt from "bcryptjs";

const ROUNDS = 12;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return "Пароль должен быть не короче 8 символов";
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return "Пароль должен содержать буквы и цифры";
  }
  return null;
}
