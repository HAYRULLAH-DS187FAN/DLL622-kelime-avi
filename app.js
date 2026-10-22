(() => {
  "use strict";

  const LETTERS = new Set(Array.from("ABCÇDEFGĞHIİJKLMNOÖPRSŞTUÜVYZ"));
  const LENGTHS = [4, 5, 6, 7, 8];
  const DAILY_COUNT = 5;
  const MAX_GUESSES = 6;
  const STORAGE_PREFIX = "kelime-arena-v1";
  const turkish = value => value.toLocaleUpperCase("tr-TR");
  const lowerTurkish = value => value.toLocaleLowerCase("tr-TR");

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const board = $("#board");
  const keyboard = $("#keyboard");
  const message = $("#game-message");
  const nextArea = $("#next-area");
  const nextButton = $("#next-button");
  const attemptCount = $("#attempt-count");
  const roundLabel = $("#round-label");
  const demoWarning = $("#demo-warning");
  const totalCompleted = $("#total-completed");
  const dateLabel = $("#daily-date");
  const countdownLabel = $("#reset-countdown");
  const helpDialog = $("#help-dialog");

  let currentLength = 4;
  let currentRound = 0;
  let target = "";
  let state = null;
  let day = getTurkeyDate();
  let saved = {};
  let allowedWords = new Set();
  let lastMessageTimer = null;

  function formatTurkeyDateLabel() {
    return new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", day: "numeric", month: "long", year: "numeric" }).format(new Date()).toLocaleUpperCase("tr-TR");
  }

  function getTurkeyDate() {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const part = key => parts.find(item => item.type === key)?.value || "00";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  function getTomorrowTurkeyDate() {
    const [year, month, date] = getTurkeyDate().split("-").map(Number);
    const tomorrow = new Date(Date.UTC(year, month - 1, date + 1));
    return `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
  }

  function getTurkeyUtcOffset(dateString) {
    const probe = new Date(`${dateString}T12:00:00Z`);
    const zone = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", timeZoneName: "longOffset" })
      .formatToParts(probe).find(part => part.type === "timeZoneName")?.value || "GMT+03:00";
    return zone === "GMT" ? "Z" : zone.replace("GMT", "");
  }

  function updateCountdown() {
    if (!countdownLabel) return;
    const tomorrow = getTomorrowTurkeyDate();
    const offset = getTurkeyUtcOffset(tomorrow);
    const nextMidnight = new Date(`${tomorrow}T00:00:00${offset}`).getTime();
    const secondsLeft = Math.max(0, Math.ceil((nextMidnight - Date.now()) / 1000));
    const hours = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
    const seconds = String(secondsLeft % 60).padStart(2, "0");
    countdownLabel.textContent = `YENİ PAKET ${hours}:${minutes}:${seconds}`;
  }

  function hashString(value) {
    let hash = 2166136261;
    for (const character of value) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value += 0x6D2B79F5;
      let t = value;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffledForDay(words, length) {
    const unique = Array.from(new Set((words || []).map(lowerTurkish)))
      .filter(word => word.length === length && Array.from(word).every(ch => LETTERS.has(turkish(ch))));
    const random = seededRandom(hashString(`${day}|${length}|kelime-arena-v1`));
    for (let i = unique.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [unique[i], unique[j]] = [unique[j], unique[i]];
    }
    return unique.slice(0, DAILY_COUNT);
  }

  function getDailyWords(length) {
    return shuffledForDay(window.WORD_DATA?.byLength?.[length] || [], length);
  }

  function storageKey(length) {
    return `${STORAGE_PREFIX}:${day}:${length}`;
  }

  function blankRound() { return { guesses: [], status: "playing" }; }

  function readCategory(length) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(length)) || "null");
      if (!parsed || !Array.isArray(parsed.rounds)) return { rounds: Array.from({ length: DAILY_COUNT }, blankRound), currentRound: 0 };
      const rounds = Array.from({ length: DAILY_COUNT }, (_, index) => {
        const item = parsed.rounds[index];
        if (!item || !Array.isArray(item.guesses)) return blankRound();
        const guesses = item.guesses.filter(guess => typeof guess === "string" && guess.length === length).slice(0, MAX_GUESSES);
        const status = ["playing", "won", "lost"].includes(item.status) ? item.status : "playing";
        return { guesses, status };
      });
      let next = Math.max(0, Math.min(DAILY_COUNT - 1, Number(parsed.currentRound) || 0));
      while (next < DAILY_COUNT - 1 && rounds[next].status !== "playing") next++;
      return { rounds, currentRound: next };
    } catch (error) {
      console.warn("Oyun kaydı okunamadı; yeni kayıt başlatılıyor.", error);
      return { rounds: Array.from({ length: DAILY_COUNT }, blankRound), currentRound: 0 };
    }
  }

  function saveCategory() {
    try {
      saved[currentLength] = { rounds: saved[currentLength].rounds, currentRound };
      localStorage.setItem(storageKey(currentLength), JSON.stringify(saved[currentLength]));
    } catch (error) {
      console.warn("Oyun ilerlemesi kaydedilemedi.", error);
      setMessage("Tarayıcı kaydı kapalı; ilerlemen bu oturumdan sonra saklanamayabilir.", "bad");
    }
  }

  function completedRounds(length) {
    const data = saved[length] || readCategory(length);
    return data.rounds.filter(round => round.status !== "playing").length;
  }

  function allDailyCompleted(length) {
    return completedRounds(length) === DAILY_COUNT;
  }

  function updateCounters() {
    let total = 0;
    for (const length of LENGTHS) {
      const done = completedRounds(length);
      total += done;
      const card = $(`.category-card[data-length="${length}"]`);
      if (card) {
        $(".category-progress", card).textContent = `${done}/${DAILY_COUNT} tamam`;
        card.classList.toggle("all-done", done === DAILY_COUNT);
      }
    }
    totalCompleted.textContent = String(total);
  }

  function selectRoundAfterLoad(length) {
    const category = saved[length];
    if (category.currentRound < DAILY_COUNT - 1 && category.rounds[category.currentRound].status !== "playing") {
      let next = category.rounds.findIndex(round => round.status === "playing");
      category.currentRound = next === -1 ? DAILY_COUNT - 1 : next;
    }
    return category.currentRound;
  }

  function startCategory(length) {
    currentLength = length;
    if (!saved[length]) saved[length] = readCategory(length);
    currentRound = selectRoundAfterLoad(length);
    const choices = getDailyWords(length);
    if (choices.length < DAILY_COUNT) {
      target = "";
      state = blankRound();
      renderBoard();
      renderKeyboard();
      roundLabel.textContent = `${length} HARFLİ KELİME`;
      attemptCount.textContent = "0";
      nextArea.hidden = true;
      setMessage(`Bu kategoride ${DAILY_COUNT} farklı kelime bulunamadı. Tam havuz için README'deki hazırlama adımını çalıştır.`, "bad");
      updateCounters();
      return;
    }
    target = choices[currentRound];
    state = saved[length].rounds[currentRound];
    $$(".category-card").forEach(card => card.classList.toggle("active", Number(card.dataset.length) === length));
    roundLabel.textContent = `${length} HARFLİ KELİME · ${currentRound + 1}. BULMACA`;
    attemptCount.textContent = String(state.guesses.length);
    renderBoard();
    renderKeyboard();
    nextArea.hidden = state.status === "playing" && !allDailyCompleted(length);
    if (state.status === "won") setMessage(`Bildin! Cevap ${turkish(target)}. Sonraki kelimeye geçebilirsin.`, "good");
    else if (state.status === "lost") setMessage(`Bu kelimenin cevabı ${turkish(target)} idi. Bir sonrakinde şansını dene!`, "bad");
    else if (allDailyCompleted(length)) setMessage("Bu kategorinin bugünkü 5 kelimesini tamamladın. Yarın yeni paket!", "good");
    else setMessage(state.guesses.length ? "Devam et; kalan tahminlerini kullan." : "Bir kelime yaz ve Enter'a bas.", "");
    updateCounters();
  }

  function renderBoard() {
    board.innerHTML = "";
    board.style.setProperty("--cols", String(currentLength));
    for (let row = 0; row < MAX_GUESSES; row++) {
      const guess = state?.guesses?.[row] || "";
      const evaluated = guess ? evaluateGuess(guess, target) : [];
      for (let col = 0; col < currentLength; col++) {
        const tile = document.createElement("div");
        tile.className = "tile";
        tile.setAttribute("aria-label", guess[col] ? `${guess[col]}, ${col + 1}. harf` : "Boş harf kutusu");
        if (guess[col]) {
          tile.textContent = turkish(guess[col]);
          tile.classList.add("filled");
          if (state.guesses[row] && evaluated[col]) tile.classList.add(evaluated[col]);
        }
        board.appendChild(tile);
      }
    }
  }

  function evaluateGuess(guess, answer) {
    const result = Array.from({ length: answer.length }, () => "absent");
    const answerChars = Array.from(answer);
    const guessChars = Array.from(guess);
    const remaining = new Map();
    for (let i = 0; i < answerChars.length; i++) {
      if (guessChars[i] === answerChars[i]) result[i] = "correct";
      else remaining.set(answerChars[i], (remaining.get(answerChars[i]) || 0) + 1);
    }
    for (let i = 0; i < guessChars.length; i++) {
      if (result[i] === "correct") continue;
      const count = remaining.get(guessChars[i]) || 0;
      if (count > 0) {
        result[i] = "present";
        remaining.set(guessChars[i], count - 1);
      }
    }
    return result;
  }

  function renderKeyboard() {
    keyboard.innerHTML = "";
    const rows = [
      Array.from("ERTYUIOPĞÜ"),
      Array.from("ASDFGHJKLŞİ"),
      ["ENTER", ...Array.from("BCÇMNÖVZ"), "⌫"]
    ];
    const known = new Map();
    for (const guess of state?.guesses || []) {
      const marks = evaluateGuess(guess, target);
      Array.from(guess).forEach((letter, index) => {
        const old = known.get(turkish(letter));
        const rank = mark => ({ correct: 3, present: 2, absent: 1 }[mark] || 0);
        if (!old || rank(marks[index]) > rank(old)) known.set(turkish(letter), marks[index]);
      });
    }
    rows.forEach((rowLetters, index) => {
      const row = document.createElement("div");
      row.className = "key-row";
      rowLetters.forEach(letter => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "key";
        button.textContent = letter === "ENTER" ? "ENTER" : letter;
        if (letter === "ENTER" || letter === "⌫") button.classList.add("wide");
        if (known.has(letter)) {
          const mark = known.get(letter);
          button.classList.add(mark);
          const markLabels = {
            correct: "doğru yerde",
            present: "kelimede var, yeri farklı",
            absent: "kelimede yok"
          };
          button.dataset.mark = mark;
          button.title = `${letter}: ${markLabels[mark]}`;
        }
        button.disabled = state?.status !== "playing" || !target;
        const statusText = known.has(letter) ? `, ${known.get(letter) === "absent" ? "kelimede yok" : known.get(letter) === "present" ? "başka yerde var" : "doğru yerde"}` : "";
        button.setAttribute("aria-label", letter === "⌫" ? "Son harfi sil" : letter === "ENTER" ? "Tahmini gönder" : `${letter} harfi${statusText}`);
        button.addEventListener("click", () => {
          if (letter === "ENTER") submitGuess();
          else if (letter === "⌫") removeLetter();
          else addLetter(letter);
        });
        row.appendChild(button);
      });
      keyboard.appendChild(row);
    });
  }

  function currentDraft() {
    if (!state || state.status !== "playing") return "";
    return state.draft || "";
  }

  function addLetter(letter) {
    if (!target || state.status !== "playing") return;
    const draft = currentDraft();
    if (Array.from(draft).length >= currentLength) return;
    const upper = turkish(letter);
    if (!LETTERS.has(upper)) return;
    state.draft = draft + lowerTurkish(upper);
    renderLiveDraft();
  }

  function removeLetter() {
    if (!target || state.status !== "playing") return;
    state.draft = Array.from(currentDraft()).slice(0, -1).join("");
    renderLiveDraft();
  }

  function renderLiveDraft() {
    const draft = currentDraft();
    const row = state.guesses.length;
    const tiles = $$(".tile", board);
    Array.from(draft).forEach((letter, index) => {
      const tile = tiles[row * currentLength + index];
      if (!tile) return;
      tile.textContent = turkish(letter);
      tile.classList.add("filled");
    });
    for (let index = Array.from(draft).length; index < currentLength; index++) {
      const tile = tiles[row * currentLength + index];
      if (tile) { tile.textContent = ""; tile.classList.remove("filled"); }
    }
  }

  function setMessage(text, mood = "") {
    message.textContent = text;
    message.className = `game-message${mood ? ` ${mood}` : ""}`;
    if (lastMessageTimer) clearTimeout(lastMessageTimer);
  }

  function submitGuess() {
    if (!target || state.status !== "playing") return;
    const guess = lowerTurkish(currentDraft());
    if (Array.from(guess).length !== currentLength) {
      setMessage(`Tahminin ${currentLength} harf olmalı.`, "bad");
      return;
    }
    if (!Array.from(guess).every(letter => LETTERS.has(turkish(letter)))) {
      setMessage("Yalnızca Türk alfabesindeki harfleri kullan.", "bad");
      return;
    }
    if (allowedWords.size && !allowedWords.has(guess) && !getDailyWords(currentLength).includes(guess)) {
      setMessage("Bu kelime sözlük listemizde yok. Başka bir kelime dene.", "bad");
      return;
    }
    state.guesses.push(guess);
    state.draft = "";
    const won = guess === target;
    if (won) state.status = "won";
    else if (state.guesses.length >= MAX_GUESSES) state.status = "lost";
    saved[currentLength].rounds[currentRound] = { guesses: state.guesses.slice(), status: state.status };
    saved[currentLength].currentRound = currentRound;
    saveCategory();
    renderBoard();
    renderKeyboard();
    attemptCount.textContent = String(state.guesses.length);
    if (won) {
      setMessage(`Harika! ${state.guesses.length}. tahminde bildin: ${turkish(target)}.`, "good");
      nextArea.hidden = false;
      nextButton.textContent = currentRound < DAILY_COUNT - 1 ? "Sonraki kelime →" : "Paketi tamamla ✓";
    } else if (state.status === "lost") {
      setMessage(`Tahmin hakkın bitti. Cevap: ${turkish(target)}.`, "bad");
      nextArea.hidden = false;
      nextButton.textContent = currentRound < DAILY_COUNT - 1 ? "Sonraki kelime →" : "Paketi tamamla ✓";
    } else {
      setMessage("Devam! Bir sonraki tahminini dene.");
      nextArea.hidden = true;
    }
    updateCounters();
  }

  function goNext() {
    if (!state || state.status === "playing") return;
    if (currentRound < DAILY_COUNT - 1) {
      currentRound++;
      saved[currentLength].currentRound = currentRound;
      saved[currentLength].rounds[currentRound] ||= blankRound();
      saveCategory();
      startCategory(currentLength);
    } else {
      nextArea.hidden = true;
      setMessage("Bu kategorinin bugünkü 5 kelimesini tamamladın. Yarın 00.00'da yeni paket!", "good");
      updateCounters();
    }
  }

  function handlePhysicalKey(event) {
    if (helpDialog.open || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Enter") { event.preventDefault(); submitGuess(); return; }
    if (event.key === "Backspace") { event.preventDefault(); removeLetter(); return; }
    const key = turkish(event.key);
    if (Array.from(key).length === 1 && LETTERS.has(key)) addLetter(key);
  }

  function updateDayIfNeeded() {
    const latest = getTurkeyDate();
    if (latest !== day) {
      day = latest;
      saved = {};
      dateLabel.textContent = formatTurkeyDateLabel();
      updateCountdown();
      startCategory(currentLength);
    }
  }

  function init() {
    dateLabel.textContent = formatTurkeyDateLabel();
    updateCountdown();
    if (window.WORD_DATA?.isDemo) demoWarning.hidden = false;
    const allAllowed = window.WORD_DATA?.allowed || Object.values(window.WORD_DATA?.byLength || {}).flat();
    allowedWords = new Set(allAllowed.map(lowerTurkish));
    $$(".category-card").forEach(card => card.addEventListener("click", () => startCategory(Number(card.dataset.length))));
    nextButton.addEventListener("click", goNext);
    $("#help-button").addEventListener("click", () => helpDialog.showModal());
    helpDialog.addEventListener("click", event => { if (event.target === helpDialog) helpDialog.close(); });
    document.addEventListener("keydown", handlePhysicalKey);
    startCategory(currentLength);
    updateCounters();
    // Geri sayım ve gün değişimi kendiliğinden yenilenir; sayfayı yenilemek gerekmez.
    window.setInterval(() => { updateDayIfNeeded(); updateCountdown(); }, 1_000);
  }

  // Kelime verisi ilk açılışta alınamazsa cache-busting parametresiyle yeniden dene.
  function bootWithWordData(retries = 3) {
    const data = window.WORD_DATA;
    if (data?.byLength && Array.isArray(data.allowed)) {
      init();
      return;
    }
    if (retries <= 0) {
      setMessage("Kelime listesi yüklenemedi. İnternet bağlantını kontrol edip sayfayı yeniden aç.", "bad");
      return;
    }
    setMessage("Kelime listesi yükleniyor; otomatik olarak yeniden deneniyor…", "");
    const retryScript = document.createElement("script");
    retryScript.src = "words.js?retry=" + Date.now() + "-" + retries;
    retryScript.onload = () => {
      if (window.WORD_DATA?.byLength && Array.isArray(window.WORD_DATA.allowed)) init();
      else window.setTimeout(() => bootWithWordData(retries - 1), 300);
    };
    retryScript.onerror = () => window.setTimeout(() => bootWithWordData(retries - 1), 500);
    document.head.appendChild(retryScript);
  }

  bootWithWordData();
})();
