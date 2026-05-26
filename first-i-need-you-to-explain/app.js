const STORAGE_KEY = "grateful-reminders-items";
const SETTINGS_KEY = "grateful-reminders-settings";
const SCHEDULE_KEY = "grateful-reminders-schedule";
const AUTO_QUOTES = [
  {
    quote: "Well done is better than well said.",
    author: "Benjamin Franklin"
  },
  {
    quote: "No act of kindness, no matter how small, is ever wasted.",
    author: "Aesop"
  },
  {
    quote: "What stands in the way becomes the way.",
    author: "Marcus Aurelius"
  },
  {
    quote: "The journey of a thousand miles begins with one step.",
    author: "Lao Tzu"
  },
  {
    quote: "Nothing will work unless you do.",
    author: "Maya Angelou"
  },
  {
    quote: "It always seems impossible until it is done.",
    author: "Nelson Mandela"
  },
  {
    quote: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin"
  },
  {
    quote: "The secret of getting ahead is getting started.",
    author: "Mark Twain"
  },
  {
    quote: "I dwell in possibility.",
    author: "Emily Dickinson"
  },
  {
    quote: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt"
  },
  {
    quote: "Hope is the thing with feathers.",
    author: "Emily Dickinson"
  },
  {
    quote: "Happiness depends upon ourselves.",
    author: "Aristotle"
  }
];
const QUOTE_API_URL = "https://api.quotable.io/quotes";
const QUOTE_CACHE_KEY = "grateful-reminders-quote-bank";
const QUOTE_BANK_TARGET = 300;

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
let quoteBank = loadJSON(QUOTE_CACHE_KEY, AUTO_QUOTES);

items = dedupeQuotes(normalizeItems(items));
saveItems();
startTime.value = settings.start;
endTime.value = settings.end;

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
