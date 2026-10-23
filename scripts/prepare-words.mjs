import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const CORE_SOURCE_URL = 'https://pulmaca.com.tr/veri/pulmaca-cekirdek.txt';
const TDK_WORDS_URL = 'https://raw.githubusercontent.com/ahakanacar/turkish-dictionary-dataset-and-statistics/main/turkish_words_raw.txt';
const PROPER_NAME_URLS = [
  'https://pulmaca.com.tr/veri/kategoriler/isim.txt',
  'https://pulmaca.com.tr/veri/kategoriler/sehir.txt',
  'https://pulmaca.com.tr/veri/kategoriler/ulke.txt'
];
const LOWER_ALPHABET = /^[abcçdefgğhıijklmnoöprsştuüvyz]+$/;
const LENGTHS = [4, 5, 6, 7, 8];
const WORDS_PER_LENGTH = 500;
const KNOWN_NON_TURKISH_FALSE_POSITIVES = new Set(['sunny']);

function stableRank(word) {
  return createHash('sha256').update(`dll622-turkish-target-v2:${word}`, 'utf8').digest('hex');
}

function cleanLine(line) {
  return line.trim().replace(/^"(.*)"$/, '$1').normalize('NFC');
}

function isLengthAllowed(word) {
  return LENGTHS.includes(Array.from(word).length);
}

function lowerValidWord(input) {
  const word = cleanLine(input).toLocaleLowerCase('tr-TR');
  if (!LOWER_ALPHABET.test(word) || !isLengthAllowed(word)) return null;
  return word;
}

function parseList(text) {
  return text.split(/\r?\n/).map(cleanLine).filter(Boolean);
}

async function fetchText(url, label) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'DLL622-Kelime-Avi-wordlist-builder/2.0' },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`${label} alınamadı: HTTP ${response.status} (${url})`);
  return response.text();
}

async function main() {
  console.log('Türkçe kelime kaynakları indiriliyor…');
  const [coreText, tdkText, ...properNameTexts] = await Promise.all([
    fetchText(CORE_SOURCE_URL, 'Çekirdek kelime listesi'),
    fetchText(TDK_WORDS_URL, 'TDK tabanlı Türkçe sözlük listesi'),
    ...PROPER_NAME_URLS.map((url, index) => fetchText(url, `Özel isim listesi ${index + 1}`))
  ]);

  const coreWords = new Set(parseList(coreText)
    .map(word => word.normalize('NFC').toLocaleLowerCase('tr-TR'))
    .filter(word => LOWER_ALPHABET.test(word) && isLengthAllowed(word)));

  const tdkEntries = parseList(tdkText)
    .filter(entry => LOWER_ALPHABET.test(entry.toLocaleLowerCase('tr-TR')) && isLengthAllowed(entry.toLocaleLowerCase('tr-TR')));
  const tdkAllWords = new Set(tdkEntries.map(entry => entry.toLocaleLowerCase('tr-TR')));
  const tdkCommonWords = new Set(tdkEntries
    .filter(entry => entry === entry.toLocaleLowerCase('tr-TR'))
    .map(entry => entry.toLocaleLowerCase('tr-TR')));

  // Baş harfi büyük ve geri kalanı küçük biçimde bulunan, küçük harfli sözlük karşılığı olmayan girdileri
  // hedef havuzundan dışarıda tut. Bu sözcükler tahmin listesinde kalabilir.
  const properOnly = new Set(tdkEntries
    .filter(entry => {
      const lower = entry.toLocaleLowerCase('tr-TR');
      const title = lower.charAt(0).toLocaleUpperCase('tr-TR') + lower.slice(1);
      return entry === title && !tdkCommonWords.has(lower);
    })
    .map(entry => entry.toLocaleLowerCase('tr-TR')));

  const properNames = new Set();
  for (const sourceText of properNameTexts) {
    for (const entry of parseList(sourceText)) {
      const word = lowerValidWord(entry);
      if (word) properNames.add(word);
    }
  }

  const byLength = {};
  for (const length of LENGTHS) {
    const fromCore = [...coreWords].filter(word =>
      Array.from(word).length === length && tdkCommonWords.has(word) && !properOnly.has(word));
    const fallback = [...tdkCommonWords].filter(word =>
      Array.from(word).length === length && !properOnly.has(word) && !coreWords.has(word));
    const candidates = [...new Set(fromCore)];
    if (candidates.length < WORDS_PER_LENGTH) candidates.push(...fallback);
    if (candidates.length < WORDS_PER_LENGTH) {
      throw new Error(`${length} harfli doğrulanmış Türkçe hedef kelime sayısı ${candidates.length}; ${WORDS_PER_LENGTH} gerekiyor.`);
    }

    byLength[length] = candidates
      .sort((a, b) => stableRank(a).localeCompare(stableRank(b)))
      .slice(0, WORDS_PER_LENGTH)
      .sort((a, b) => a.localeCompare(b, 'tr-TR'));
    console.log(`${length} harf: ${byLength[length].length} hedef kelime hazır.`);
  }

  // Tahmin havuzu TDK tabanlı liste + ayrı özel isim/şehir/ülke listelerinden üretilir.
  // Pulmaca'nın geniş listesini doğrudan kullanmıyoruz: içinde sözlükte bulunmayan "sunny" gibi girdiler olabiliyor.
  const allowedSet = new Set([...tdkAllWords, ...properNames]);
  const allowed = [...allowedSet]
    .filter(word => LOWER_ALPHABET.test(word) && isLengthAllowed(word) && !KNOWN_NON_TURKISH_FALSE_POSITIVES.has(word))
    .sort((a, b) => a.localeCompare(b, 'tr-TR'));

  if (allowed.length < 5000) {
    throw new Error(`Kabul edilen tahmin listesi yalnızca ${allowed.length} kelime içeriyor; en az 5.000 bekleniyordu. Kaynak verisini kontrol et.`);
  }

  const output = `/* Türkçe sözlük ve özel isim kaynakları için ATTRIBUTION.md dosyasına bakın. */\nwindow.WORD_DATA = ${JSON.stringify({ isDemo: false, byLength, allowed }, null, 2)};\n`;
  await writeFile(new URL('../words.js', import.meta.url), output, 'utf8');
  const targetCount = Object.values(byLength).reduce((count, list) => count + list.length, 0);
  console.log(`Tamamlandı: ${targetCount.toLocaleString('tr-TR')} hedef kelime; ${allowed.length.toLocaleString('tr-TR')} kabul edilen tahmin.`);
}

main().catch(error => {
  console.error(`\nKelime havuzu hazırlanamadı: ${error.message}`);
  console.error('Kaynak erişilemiyorsa işlem durur; eksik/test kelimeleriyle sözlük üretilmez.');
  process.exitCode = 1;
});
