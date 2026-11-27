// Ключи для хранилища
const CURRENT_KEY = 'shopping_list_current_v1';
const HISTORY_KEY = 'shopping_list_history_v1';

// Загружаем данные
let items = loadCurrent();
let history = loadHistory();

// Элементы страницы
const form = document.getElementById('add-form');
const input = document.getElementById('item-input');
const listEl = document.getElementById('shopping-list');
const emptyMessage = document.getElementById('empty-message');
const finishBtn = document.getElementById('finish-btn');
const recBox = document.getElementById('recommendations-box');
const recList = document.getElementById('recommendations-list');

// ---------- Загрузка / Сохранение ----------
function loadCurrent() {
  const raw = localStorage.getItem(CURRENT_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveCurrent() {
  localStorage.setItem(CURRENT_KEY, JSON.stringify(items));
}

function loadHistory() {
  const raw = localStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ---------- Логика текущего списка ----------
function render() {
  listEl.innerHTML = '';

  // Показываем/скрываем кнопку завершения и текст "пусто"
  if (items.length === 0) {
    emptyMessage.classList.remove('hidden');
    finishBtn.classList.add('hidden');
  } else {
    emptyMessage.classList.add('hidden');
    finishBtn.classList.remove('hidden');
  }

  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'list-item' + (item.bought ? ' bought' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.bought;
    checkbox.addEventListener('change', () => toggleBought(item.id));

    const span = document.createElement('span');
    span.className = 'item-text';
    span.textContent = item.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Удалить';
    delBtn.addEventListener('click', () => deleteItem(item.id));

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(delBtn);
    listEl.appendChild(li);
  });
}

function addItem(name) {
  const trimmed = name.trim();
  if (!trimmed) return;

  items.push({
    id: Date.now().toString(),
    name: trimmed,
    bought: false
  });

  saveCurrent();
  render();
}

function toggleBought(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  item.bought = !item.bought;
  saveCurrent();
  render();
}

function deleteItem(id) {
  items = items.filter(i => i.id !== id);
  saveCurrent();
  render();
}

// ---------- Завершение списка и История ----------
function finishShopping() {
  if (items.length === 0) return;

  // Сохраняем в историю
  history.push({
    date: new Date().toISOString(),
    items: items
  });
  
  // Очищаем текущий список
  items = [];
  
  saveHistory();
  saveCurrent();
  
  render();
  updateRecommendations();
}

// ---------- Анализ и Рекомендации ----------
function updateRecommendations() {
  if (history.length === 0) {
    recBox.classList.add('hidden');
    return;
  }

  const counts = {};
  history.forEach(list => {
    list.items.forEach(item => {
      const name = item.name.toLowerCase();
      counts[name] = (counts[name] || 0) + 1;
    });
  });

  const sorted = Object.keys(counts)
    .map(name => ({ name, count: counts[name] }))
    .sort((a, b) => b.count - a.count);

  const top = sorted.slice(0, 6);

  recList.innerHTML = '';
  
  if (top.length > 0) {
    recBox.classList.remove('hidden');
    
    top.forEach(item => {
      const chip = document.createElement('div');
      chip.className = 'rec-chip';
      chip.textContent = item.name.charAt(0).toUpperCase() + item.name.slice(1);
      
      chip.addEventListener('click', () => {
        const exists = items.some(i => i.name.toLowerCase() === item.name);
        if (!exists) {
          addItem(item.name);
        }
      });
      
      recList.appendChild(chip);
    });
  } else {
    recBox.classList.add('hidden');
  }
}

// ---------- События ----------
form.addEventListener('submit', (e) => {
  e.preventDefault();
  addItem(input.value);
  input.value = '';
  input.focus();
});

finishBtn.addEventListener('click', finishShopping);

// ---------- Первый запуск ----------
render();
updateRecommendations();