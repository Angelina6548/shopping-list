import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, writeBatch } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const firebaseConfig = {
    apiKey: "AIzaSyDvchEAM9O5AtMzKmmmBO3ty_MKNtJA6Oc",
    authDomain: "shopping-list-4ce24.firebaseapp.com",
    projectId: "shopping-list-4ce24",
    storageBucket: "shopping-list-4ce24.firebasestorage.app",
    messagingSenderId: "601763375312",
    appId: "1:601763375312:web:e6e08fe6d0a920885a16d5"
  };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {localCache: persistentLocalCache({tabManager: persistentMultipleTabManager()})});
let items = [], history = [], uid, ready = false, unsub = [];
const login = document.getElementById('login'), content = document.getElementById('content'), status = document.getElementById('status');
const say = s => status.textContent = s;
const report = e => { console.error(e); say('Ошибка сохранения или доступа: ' + e.code); };
const col = name => collection(db, 'users', uid, name);
const itemDoc = id => doc(col('items'), id);
const form = document.getElementById('add-form');
const input = document.getElementById('item-input');
const listEl = document.getElementById('shopping-list');
const emptyMessage = document.getElementById('empty-message');
const finishBtn = document.getElementById('finish-btn');
const recBox = document.getElementById('recommendations-box');
const recList = document.getElementById('recommendations-list');

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

function updateRecommendations() {
  if (history.length === 0) {
    recBox.classList.add('hidden');
    return;
  }

  const counts = Object.create(null);
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


function addItem(name) {
  name = name.trim(); if (!ready || !name) return;
  const ref = doc(col('items'));
  setDoc(ref, {name, bought:false, createdAt:Date.now()}).catch(report);
}
function toggleBought(id) {
  const item = items.find(i => i.id === id);
  if (ready && item) updateDoc(itemDoc(id), {bought:!item.bought}).catch(report);
}
function deleteItem(id) { if (ready) deleteDoc(itemDoc(id)).catch(report); }
function finishShopping() {
  if (!ready || !items.length) return;
  if (items.length > 499) { say('Слишком много товаров для завершения за один раз.'); return; }
  const batch = writeBatch(db);
  batch.set(doc(col('history')), {date:new Date().toISOString(), items:items.map(({id,name,bought})=>({id,name,bought}))});
  items.forEach(i=>batch.delete(itemDoc(i.id)));
  batch.commit().catch(report);
}
form.addEventListener('submit', e=>{e.preventDefault(); addItem(input.value); input.value=''; input.focus();});
finishBtn.addEventListener('click', finishShopping);
login.addEventListener('submit', async e=>{
  e.preventDefault(); const button=login.querySelector('button'); button.disabled=true;
  try { await setPersistence(auth,browserLocalPersistence); await signInWithEmailAndPassword(auth,document.getElementById('email').value,document.getElementById('password').value); login.reset(); }
  catch(e){say('Не удалось войти: проверьте почту, пароль и интернет.'); console.error(e);}
  finally {button.disabled=false;}
});
onAuthStateChanged(auth,user=>{
  unsub.forEach(fn=>fn()); unsub=[]; ready=false; items=[]; history=[];
  login.classList.toggle('hidden',!!user); content.classList.toggle('hidden',!user);
  if(!user){say('Войдите один раз на этом устройстве.');return;}
  uid=user.uid; say('Загрузка списка…'); render(); updateRecommendations();
  unsub.push(onSnapshot(col('items'),{includeMetadataChanges:true},snap=>{
    items=snap.docs.map(d=>({...d.data(),id:d.id})).sort((a,b)=>a.createdAt-b.createdAt); ready=true;
    say(snap.metadata.hasPendingWrites?'Ожидает синхронизации…':snap.metadata.fromCache?'Локальная копия · ожидаем связь':'Список синхронизирован'); render(); updateRecommendations();
  },report));
  unsub.push(onSnapshot(col('history'),snap=>{history=snap.docs.map(d=>d.data());updateRecommendations();},report));
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);
