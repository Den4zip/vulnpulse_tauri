import type { CommandErrorCode } from '../../generated/contracts';

const messages: Record<CommandErrorCode, string> = {
  invalid_request: 'Недопустимый запрос к каталогу.',
  busy: 'Каталог занят. Попробуйте ещё раз.',
  unavailable: 'Не удалось открыть локальный каталог.',
};

export function commandErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (typeof code === 'string' && Object.hasOwn(messages, code)) {
      return messages[code as CommandErrorCode];
    }
  }
  return 'Не удалось получить данные. Повторите попытку в приложении VulnPulse.';
}
