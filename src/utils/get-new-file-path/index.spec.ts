import { getNewFilePath } from '.';

describe('getNewFilePath', () => {
  it('should generate a file path with timezone offset instead of zone name', () => {
    const result = getNewFilePath('png');

    // Verificar que el formato de la ruta sea correcto
    // El formato esperado es: optimized/YYYY-MM-DD-HH-MM-SS-SSS-OFFSET_UUID.png
    expect(result).toMatch(
      /^optimized\/\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-\d{3}_-\d+_[\w-]+\.png$/,
    );

    // Verificar que no contenga 'America/Caracas' sino un offset numérico
    expect(result).not.toContain('America/Caracas');
    expect(result).toMatch(/--\d+_/);
  });
});
