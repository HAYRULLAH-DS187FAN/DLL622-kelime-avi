import { cp, mkdir, rm, copyFile, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const prepareScript = fileURLToPath(new URL('./prepare-words.mjs', import.meta.url));
const wordsPath = path.join(root, 'words.js');
const lengths = [4, 5, 6, 7, 8];
const alphabet = new Set(Array.from('ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ'));

async function readProductionWordData() {
  try {
    const source = await readFile(wordsPath, 'utf8');
    const match = source.match(/window\.WORD_DATA\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (data?.isDemo !== false || !data.byLength || !Array.isArray(data.allowed)) return null;

    for (const length of lengths) {
      const words = data.byLength[length];
      if (!Array.isArray(words) || words.length !== 500 || new Set(words).size !== 500) return null;
      for (const word of words) {
        const chars = Array.from(String(word).toLocaleUpperCase('tr-TR'));
        if (chars.length !== length || !chars.every(char => alphabet.has(char))) return null;
      }
    }
    // A complete 4–8 letter Turkish guess list should be much larger than the small demo list.
    if (data.allowed.length < 5_000) return null;
    return data;
  } catch {
    return null;
  }
}

async function prepareWordData() {
  console.log('Tam sözlük bulunamadı; Türkçe kelime havuzu hazırlanıyor...');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [prepareScript], { cwd: root, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Kelime havuzu hazırlama işlemi ${code} koduyla sonlandı.`)));
  });
  const data = await readProductionWordData();
  if (!data) throw new Error('words.js dosyası tam 2.500 hedef kelime ve yeterli tahmin listesi içermiyor. Demo verisiyle yayın yapılmadı.');
  console.log(`Kelime havuzu doğrulandı: 2.500 hedef, ${data.allowed.length} kabul edilen tahmin.`);
}

let wordData = await readProductionWordData();
if (!wordData) {
  await prepareWordData();
  wordData = await readProductionWordData();
}
if (!wordData) throw new Error('Üretim kelime havuzu doğrulanamadı.');
console.log(`DLL622 Kelime Avı: mevcut kelime havuzu kullanılacak (${wordData.allowed.length} kabul edilen tahmin).`);

const output = path.join(root, 'dist');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'words.js', 'dll622-logo.jpg', 'ATTRIBUTION.md']) {
  await copyFile(path.join(root, file), path.join(output, file));
}
console.log('Dağıtım dosyaları dist/ klasörüne hazırlandı.');
