export interface PasswordResetMail {
  to: string;
  resetToken: string;
  resetUrl: string;
  expiresAt: Date;
}

export interface MailProvider {
  sendPasswordReset(mail: PasswordResetMail): Promise<void>;
}

export class ConsoleMailProvider implements MailProvider {
  async sendPasswordReset(mail: PasswordResetMail): Promise<void> {
    console.info(
      `[MailProvider] Şifre sıfırlama -> ${mail.to}\n` +
        `  Bağlantı : ${mail.resetUrl}\n` +
        `  Token    : ${mail.resetToken}\n` +
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

let activeMailProvider: MailProvider = new ConsoleMailProvider();

export function getMailProvider(): MailProvider {
  return activeMailProvider;
}

export function setMailProvider(provider: MailProvider): void {
  activeMailProvider = provider;
}
