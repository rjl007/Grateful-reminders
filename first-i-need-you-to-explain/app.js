const STORAGE_KEY = "grateful-reminders-items";
const SETTINGS_KEY = "grateful-reminders-settings";
const SCHEDULE_KEY = "grateful-reminders-schedule";
const AUTO_QUOTES = [
  {
    text: "Well done is better than well said.",
    author: "Benjamin Franklin"
  },
  {
    text: "No act of kindness, no matter how small, is ever wasted.",
    author: "Aesop"
  },
  {
    text: "What stands in the way becomes the way.",
    author: "Marcus Aurelius"
  },
  {
    text: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu"
  },
  {
    text: "Nothing will work unless you do.",
    author: "Maya Angelou"
  },
  {
    text: "It always seems impossible until it is done.",
    author: "Nelson Mandela"
  },
  {
    text: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin"
  },
  {
    text: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  },
  {
    text: "I dwell in possibility.",
    author: "Emily Dickinson"
  },
  {
    text: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt"
  },
  {
    text: "Hope is the thing with feathers.",
    author: "Emily Dickinson"
  },
  {
    text: "Happiness depends upon ourselves.",
    author: "Aristotle"
  }
];

const form = document.querySelector("#gratitude-form");
const input = document.querySelector("#gratitude-input");
const list = document.querySelector("#gratitude-list");
const emptyState = document.querySelector("#empty-state");
const countLabel = document.querySelector("#gratitude-count");
const startTime = document.querySelector("#start-time");
const endTime = document.querySelector("#end-time");
const scheduleButton = document.querySelector("#schedule-reminders");
const testButton = document.querySelector("#test-reminder");
const scheduleEl = document.querySelector("#schedule");
const permissionNotice = document.querySelector("#permission-notice");
const notificationPreview = document.querySelector("#notification-preview");

let items = loadJSON(STORAGE_KEY, [
  {
    text: "The people who love me",
    quote: "No act of kindness, no matter how small, is ever wasted.",
    author: "Aesop"
  },
  {
    text: "A safe place to rest",
    quote: "Happiness depends upon ourselves.",
    author: "Aristotle"
  },
  {
    text: "Another day to grow",
    quote: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu"
  }
]);
let settings = loadJSON(SETTINGS_KEY, { start: "09:00", end: "21:00" });
let schedule = loadJSON(SCHEDULE_KEY, []);
let reminderTimers = [];

items = dedupeQuotes(normalizeItems(items));
saveItems();
startTime.value = settings.start;
endTime.value = settings.end;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

renderItems();
renderSchedule();
armStoredSchedule();

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();

  if (!text) {
    input.focus();
    return;
  }

  const quote = nextAvailableQuote(normalizeItems(items));
  items = [{ id: crypto.randomUUID(), text, ...quote }, ...normalizeItems(items)];
  saveItems();
  input.value = "";
  renderItems();
});

scheduleButton.addEventListener("click", async () => {
  settings = { start: startTime.value, end: endTime.value };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  if (!normalizeItems(items).length) {
    showNotice("Add at least one thing you are grateful for first.");
    return;
  }

  const permission = await askForNotificationPermission();
  if (permission !== "granted") {
    showNotice("Notifications are not on yet. You can still use Test now while the app is open.");
    return;
  }

  schedule = buildDailySchedule(settings.start, settings.end);
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
  renderSchedule();
  armStoredSchedule();
  showNotice("All set. I scheduled three random gratitude reminders for today.");
});

testButton.addEventListener("click", async () => {
  if (!normalizeItems(items).length) {
    showNotice("Add at least one gratitude item first.");
    return;
  }

  await askForNotificationPermission();
  sendReminder();
});

function renderItems() {
  const normalized = normalizeItems(items);
  countLabel.textContent = `${normalized.length} saved`;
  emptyState.hidden = normalized.length > 0;
  list.innerHTML = "";

  normalized.forEach((item) => {
    const li = document.createElement("li");
    li.className = "gratitude-item";

    const content = document.createElement("div");
    content.className = "gratitude-content";

    const text = document.createElement("span");
    text.className = "gratitude-text";
    text.textContent = item.text;

    const quote = document.createElement("p");
    quote.className = "gratitude-quote";
    quote.textContent = item.quote;

    const author = document.createElement("p");
    author.className = "quote-author";
    author.textContent = `- ${item.author}`;

    content.append(text, quote, author);

    const button = document.createElement("button");
    button.className = "delete-button";
    button.type = "button";
    button.textContent = "Delete";
    button.setAttribute("aria-label", `Delete ${item.text}`);
    button.addEventListener("click", () => {
      items = normalizeItems(items).filter((saved) => saved.id !== item.id);
      saveItems();
      renderItems();
    });

    li.append(content, button);
    list.append(li);
  });
}

function renderSchedule() {
  const futureSchedule = schedule.filter((entry) => entry.time > Date.now());
  scheduleEl.innerHTML = "";

  if (!futureSchedule.length) {
    const card = document.createElement("div");
    card.className = "schedule-card";
    card.innerHTML = `
      <span class="time-pill">Today</span>
      <p>No active reminders yet. Choose your hours, then schedule today.</p>
    `;
    scheduleEl.append(card);
    return;
  }

  futureSchedule.forEach((entry, index) => {
    const date = new Date(entry.time);
    const card = document.createElement("div");
    card.className = "schedule-card";
    card.innerHTML = `
      <span class="time-pill">${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
      <p>Reminder ${index + 1} will pick one saved gratitude item at random.</p>
    `;
    scheduleEl.append(card);
  });
}

function armStoredSchedule() {
  reminderTimers.forEach(clearTimeout);
  reminderTimers = [];

  const futureSchedule = schedule.filter((entry) => entry.time > Date.now());
  if (futureSchedule.length !== schedule.length) {
    schedule = futureSchedule;
    localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
    renderSchedule();
  }

  futureSchedule.forEach((entry) => {
    const delay = entry.time - Date.now();
    const timer = setTimeout(() => {
      sendReminder();
      schedule = schedule.filter((saved) => saved.id !== entry.id);
      localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
      renderSchedule();
    }, delay);
    reminderTimers.push(timer);
  });
}

function sendReminder() {
  const gratitude = chooseRandom(normalizeItems(items));
  if (!gratitude) return;

  const title = "Gratitude wave";
  const body = gratitude.quote ? `${gratitude.text}\n\n${gratitude.quote}\n- ${gratitude.author}` : gratitude.text;
  showNotificationPreview(gratitude);

  showSystemNotification(title, body);
}

async function showSystemNotification(title, body) {
  if (!("Notification" in window)) {
    showNotice("This browser cannot show system notifications, so I showed the colorful preview below.");
    return;
  }

  const permission = await askForNotificationPermission();
  if (permission !== "granted") {
    showNotice("Notifications are not turned on yet, so I showed the colorful preview below.");
    return;
  }

  const options = {
    body,
    icon: "icon.svg",
    badge: "icon.svg",
    image: "icon.svg",
    vibrate: [80, 40, 80],
    tag: `gratitude-${Date.now()}`
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Service worker unavailable")), 1000);
        })
      ]);
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Opening the app as a file cannot use service workers; a regular notification is the fallback.
  }

  new Notification(title, options);
}

function showNotificationPreview(gratitude) {
  notificationPreview.hidden = false;
  notificationPreview.innerHTML = "";

  const badge = document.createElement("span");
  badge.className = "preview-badge";
  badge.textContent = "Wave";

  const content = document.createElement("div");
  content.className = "preview-content";

  const title = document.createElement("strong");
  title.textContent = "Gratitude wave";

  const text = document.createElement("p");
  text.textContent = gratitude.text;

  const quote = document.createElement("blockquote");
  quote.textContent = gratitude.quote;

  const author = document.createElement("cite");
  author.textContent = `- ${gratitude.author}`;

  content.append(title, text, quote, author);
  notificationPreview.append(badge, content);
}

function buildDailySchedule(start, end) {
  const today = new Date();
  const startDate = timeToDate(today, start);
  let endDate = timeToDate(today, end);

  if (endDate <= startDate) {
    endDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);
  }

  const now = Date.now();
  const startMs = Math.max(startDate.getTime(), now + 60 * 1000);
  const endMs = endDate.getTime();

  if (endMs <= startMs) {
    showNotice("That time window has already passed. Pick a later end time.");
    return [];
  }

  return Array.from({ length: 3 }, () => ({
    id: crypto.randomUUID(),
    time: randomBetween(startMs, endMs)
  })).sort((a, b) => a.time - b.time);
}

function timeToDate(baseDate, value) {
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function askForNotificationPermission() {
  if (!("Notification" in window)) {
    showNotice("This browser does not support notifications, so reminders will show only while the app is open.");
    return "unsupported";
  }

  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }

  return Notification.permission;
}

function showNotice(message) {
  permissionNotice.textContent = message;
}

function chooseRandom(values) {
  if (!values.length) return null;
  return values[Math.floor(Math.random() * values.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function normalizeItems(value) {
  const usedQuotes = new Set();

  return value.map((item, index) => {
    if (typeof item === "string") {
      const quote = quoteForIndex(index, usedQuotes);
      usedQuotes.add(quote.text);
      return { id: crypto.randomUUID(), text: item, ...quote };
    }

    const text = item.text || "";
    const existingQuote = item.quote && item.author ? { text: item.quote, author: item.author } : null;
    const quote = existingQuote || quoteForIndex(index, usedQuotes);
    usedQuotes.add(quote.text);

    return {
      id: item.id || crypto.randomUUID(),
      text,
      quote: quote.text,
      author: quote.author
    };
  });
}

function dedupeQuotes(savedItems) {
  const usedQuotes = new Set();

  return savedItems.map((item, index) => {
    if (item.quote && !usedQuotes.has(item.quote)) {
      usedQuotes.add(item.quote);
      return item;
    }

    const quote = quoteForIndex(index, usedQuotes);
    usedQuotes.add(quote.text);
    return { ...item, quote: quote.text, author: quote.author };
  });
}

function nextAvailableQuote(savedItems) {
  const usedQuotes = new Set(savedItems.map((item) => item.quote).filter(Boolean));
  return quoteForIndex(savedItems.length, usedQuotes);
}

function quoteForIndex(index, usedQuotes) {
  const unusedQuote = AUTO_QUOTES.find((quote) => !usedQuotes.has(quote.text));
  if (unusedQuote) return unusedQuote;
  return AUTO_QUOTES[index % AUTO_QUOTES.length];
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeItems(items)));
}

function loadJSON(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return saved ?? fallback;
  } catch {
    return fallback;
  }
}
