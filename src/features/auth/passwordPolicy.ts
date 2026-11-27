const SYMBOLS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~";

export function isPasswordStrong(password: string): boolean {
  return password.length >= 12
    && /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /[0-9]/.test(password)
    && [...password].some((character) => SYMBOLS.includes(character));
}

export const PASSWORD_POLICY_MESSAGE =
  "Use at least 12 characters, including uppercase and lowercase letters, a number and a symbol.";
