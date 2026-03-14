const fs = require('fs');
const path = require('path');

describe('basic sanity checks', () => {
  test('index.html exists', () => {
    const filePath = path.resolve(__dirname, '../index.html');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('index.html contains required sections', () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf-8');
    expect(html).toMatch(/Supabase URL/);
    expect(html).toMatch(/signupBtn/);
    expect(html).toMatch(/verifyLicense/);
  });
});
