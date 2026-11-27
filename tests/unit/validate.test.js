const { validate, parseId } = require('../../src/utils/validate');
const { stockLevel } = require('../../src/services/stockService');
const AppError = require('../../src/utils/AppError');

describe('validate()', () => {
  const rules = {
    name: { required: true, minLength: 3 },
    email: { type: 'email' },
    qty: { type: 'int', min: 1, max: 10 },
    cost: { type: 'number', min: 0 },
    role: { oneOf: ['a', 'b'] },
    code: { pattern: /^[A-Z]+$/, message: 'Solo mayúsculas' },
    active: { type: 'boolean' },
  };

  test('normaliza valores válidos', () => {
    const { values, errors } = validate({ name: '  Ana  ', email: ' ANA@Mail.COM ', qty: '5', cost: '2.5', role: 'a', code: 'ABC', active: true }, rules);
    expect(errors).toEqual({});
    expect(values).toMatchObject({ name: 'Ana', email: 'ana@mail.com', qty: 5, cost: 2.5 });
  });

  test('reporta campos obligatorios y formatos no válidos', () => {
    const { errors } = validate({ email: 'x', qty: 1.5, cost: -1, role: 'z', code: 'abc', active: 'si' }, rules);
    expect(errors.name).toMatch(/obligatorio/);
    expect(errors.email).toMatch(/Correo/);
    expect(errors.qty).toMatch(/entero/);
    expect(errors.cost).toMatch(/mayor o igual/);
    expect(errors.role).toMatch(/Valores permitidos/);
    expect(errors.code).toBe('Solo mayúsculas');
    expect(errors.active).toMatch(/verdadero/);
  });

  test('respeta límites máximos y longitud', () => {
    const { errors } = validate({ name: 'ab', qty: 11 }, rules);
    expect(errors.name).toMatch(/al menos 3/);
    expect(errors.qty).toMatch(/menor o igual a 10/);
  });

  test('modo parcial no exige campos faltantes', () => {
    const { errors, values } = validate({ qty: 3 }, rules, { partial: true });
    expect(errors).toEqual({});
    expect(values).toEqual({ qty: 3 });
  });

  test('tolera cuerpos vacíos o no objeto', () => {
    expect(validate(undefined, { a: { required: true } }).errors.a).toBeDefined();
    expect(validate('texto', {}).errors).toEqual({});
  });
});

describe('parseId()', () => {
  test('acepta enteros positivos', () => expect(parseId('12')).toBe(12));
  test.each(['0', '-3', 'abc', '1.5'])('rechaza %s', (v) => {
    expect(() => parseId(v)).toThrow(AppError);
  });
});

describe('stockLevel()', () => {
  test('clasifica el nivel de stock', () => {
    expect(stockLevel(10, 10)).toBe('critico');
    expect(stockLevel(0, 5)).toBe('critico');
    expect(stockLevel(14, 10)).toBe('bajo');
    expect(stockLevel(16, 10)).toBe('normal');
  });
});
