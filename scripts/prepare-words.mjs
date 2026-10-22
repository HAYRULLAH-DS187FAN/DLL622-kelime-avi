import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const SOURCE_URL = 'https://pulmaca.com.tr/veri/pulmaca-cekirdek.txt';
const ALPHABET = /^[ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ]+$/;
const LENGTHS = [4, 5, 6, 7, 8];
const WORDS_PER_LENGTH = 500;

function stableRank(word) {
  return createHash('sha256').update(`kelime-arena-pool-v1:${word}`, 'utf8').digest('hex');
}

function uniqueValidWords(text) {
  return [...new Set(text.split(/\r?\n/)
    .map(line => line.trim().toLocaleUpperCase('tr-TR'))
    .filter(word => ALPHABET.test(word)))];
}

async function main() {
  console.log('Türkçe kelime havuzu indiriliyor…');
  const response = await fetch(SOURCE_URL, { headers: { 'User-Agent': 'KelimeArena-word-pool-builder/1.0' } });
  if (!response.ok) throw new Error(`Kelime kaynağına erişilemedi: HTTP ${response.status}`);
  const source = await response.text();
  const allWords = uniqueValidWords(source);
  const validLengths = allWords.map(word => word.toLocaleLowerCase('tr-TR'));
  const byLength = {};

  for (const length of LENGTHS) {
    const candidates = allWords.filter(word => Array.from(word).length === length);
    if (candidates.length < WORDS_PER_LENGTH) {
      throw new Error(`${length} harfli yalnızca ${candidates.length} aday bulundu; ${WORDS_PER_LENGTH} gerekiyor.`);
    }
    // Alfabetik listenin başından seçim yapıp A harfini kayırmamak için sabit hash sıralaması kullan.
    const selected = candidates.sort((a, b) => stableRank(a).localeCompare(stableRank(b)))
      .slice(0, WORDS_PER_LENGTH)
      .sort((a, b) => a.localeCompare(b, 'tr-TR'));
    byLength[length] = selected.map(word => word.toLocaleLowerCase('tr-TR'));
    console.log(`${length} harf: ${byLength[length].length} kelime hazır.`);
  }

  const allowed = [...new Set(validLengths.filter(word => {
    const length = Array.from(word).length;
    return LENGTHS.includes(length);
  }))].sort((a, b) => a.localeCompare(b, 'tr-TR'));

  const output = `/* Pulmaca çekirdek kelime listesinden hazırlanmıştır. Kaynak ve lisans: ATTRIBUTION.md */\nwindow.WORD_DATA = ${JSON.stringify({ isDemo: false, byLength, allowed }, null, 2)};\n`;
  await writeFile(new URL('../words.js', import.meta.url), output, 'utf8');
  console.log(`Bitti! words.js güncellendi (${Object.values(byLength).reduce((n, arr) => n + arr.length, 0).toLocaleString('tr-TR')} hedef kelime; ${allowed.length.toLocaleString('tr-TR')} kabul edilen tahmin).`);
}

main().catch(error => {
  console.error(`\nHata: ${error.message}`);
  console.error('İnternet bağlantını kontrol et ve tekrar dene. Kaynak adresi README.md içinde de var.');
  process.exitCode = 1;
});
