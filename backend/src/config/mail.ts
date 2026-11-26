import { env } from './env.js';
import { AppError } from '../middlewares/errorHandler.js';

export interface PasswordResetMail {
  to: string;
  resetToken: string;
  resetUrl: string;
  expiresAt: Date;
}

export interface MailProvider {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}

function assertConsoleMailAllowed(nodeEnv: string = env.NODE_ENV): void {
  if (nodeEnv === 'production') {
    throw new AppError(
      500,
      'Canlı ortamda ConsoleMailProvider kullanılamaz; gerçek bir e-posta sağlayıcısı yapılandırılmalıdır.',
    );
  }
}

export class ConsoleMailProvider implements MailProvider {
  constructor(private readonly nodeEnv: string = env.NODE_ENV) {
    assertConsoleMailAllowed(this.nodeEnv);
  }

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    assertConsoleMailAllowed(this.nodeEnv);
    console.info(
      `[MailProvider] Şifre sıfırlama -> ${mail.to}\n` +
        `  Bağlantı : ${mail.resetUrl}\n` +
        `  Son süre : ${mail.expiresAt.toISOString()}`,
    );
  }
}

export class MemoryMailProvider implements MailProvider {
  public readonly sent: PasswordResetMail[] = [];

  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    this.sent.push(mail);
  }

  clear(): void {
    this.sent.length = 0;
  }
}

let activeMailProvider: MailProvider | null = null;

export function getMailProvider(nodeEnv: string = env.NODE_ENV): MailProvider {
  if (!activeMailProvider) {
    assertConsoleMailAllowed(nodeEnv);
    activeMailProvider = new ConsoleMailProvider(nodeEnv);
  } else if (activeMailProvider instanceof ConsoleMailProvider) {
    assertConsoleMailAllowed(nodeEnv);
  }
  return activeMailProvider;
}

export function setMailProvider(provider: MailProvider | null): void {
  activeMailProvider = provider;
}
