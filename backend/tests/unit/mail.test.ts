import { describe, expect, it } from 'vitest';
import { createMailAdapter } from '../../src/application/services/mail';

const KEY = 're_test_api_key_1234567890';
const SENDER = 'seguridad@votesecureapp.com';

function className(adapter: unknown): string {
  return (adapter as { constructor: { name: string } }).constructor.name;
}

describe('createMailAdapter (bypass §2.1 e interruptor CORREO_REAL_EN_LOCAL)', () => {
  it('usa Resend en production con API key', () => {
    expect(className(createMailAdapter(KEY, SENDER, 'production'))).toBe('ResendMailAdapter');
  });

  it('usa consola en development aunque exista key (bypass por defecto)', () => {
    expect(className(createMailAdapter(KEY, SENDER, 'development'))).toBe('ConsoleMailAdapter');
  });

  it('usa Resend en development solo con el interruptor real activo', () => {
    expect(className(createMailAdapter(KEY, SENDER, 'development', true))).toBe(
      'ResendMailAdapter'
    );
  });

  it('nunca envia en test, ni con el interruptor activo', () => {
    expect(className(createMailAdapter(KEY, SENDER, 'test', true))).toBe('ConsoleMailAdapter');
  });

  it('usa consola si falta la API key (production incluida)', () => {
    expect(className(createMailAdapter(undefined, SENDER, 'production'))).toBe(
      'ConsoleMailAdapter'
    );
  });
});
