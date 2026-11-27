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
const say = s => { status.textContent = s; status.dataset.state = s === 'Список синхронизирован' ? 'online' : /Ошибка|Не удалось/.test(s) ? 'error' : 'waiting'; };
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

const groups=[
['Соусы',/майонез|сметанн.*соус|горчиц/,'🥣'],['Соусы',/кетчуп|томатн.*паст/,'🍅'],['Соусы',/соус|уксус/,'🫙'],['Выпечка',/тест[оа]|слоен|круассан/,'🥐'],['Мясо',/колбас|сосиск|сардель|ветчин/,'🌭'],['Молочные',/молок|кефир|сливк|йогурт/,'🥛'],['Молочные',/сыр|творог/,'🧀'],['Молочные',/сметан|масло слив/,'🧈'],['Выпечка',/хлеб|батон|булк|лаваш/,'🍞'],['Молочные',/яйц/,'🥚'],['Фрукты',/яблок/,'🍎'],['Фрукты',/банан/,'🍌'],['Фрукты',/апельсин|мандарин/,'🍊'],['Фрукты',/лимон/,'🍋'],['Фрукты',/виноград/,'🍇'],['Фрукты',/клубник|ягод/,'🍓'],['Фрукты',/груш/,'🍐'],['Овощи',/авокад/,'🥑'],['Овощи',/томат|помидор/,'🍅'],['Овощи',/огур/,'🥒'],['Овощи',/карто/,'🥔'],['Овощи',/морков/,'🥕'],['Овощи',/лук/,'🧅'],['Овощи',/чеснок/,'🧄'],['Овощи',/капуст|салат|зелень/,'🥬'],['Овощи',/перец/,'🫑'],['Мясо',/куриц|индей/,'🍗'],['Мясо',/мяс|фарш|говя|свинин/,'🥩'],['Рыба',/рыб|лосос|селед|тунец/,'🐟'],['Рыба',/кревет/,'🍤'],['Бакалея',/рис|греч|круп|овсян/,'🌾'],['Бакалея',/макарон|спагет/,'🍝'],['Бакалея',/мук|сахар|соль/,'🧂'],['Напитки',/кофе|чай/,'☕'],['Напитки',/вод[ауы]|сок|лимонад/,'🧃'],['Сладости',/шоколад|конфет/,'🍫'],['Сладости',/печень|торт/,'🍪'],['Дом',/мыл|шампун|гель/,'🧴'],['Дом',/бумаг|салфет/,'🧻'],['Дом',/порошок|губк|чистящ/,'🧽'],['Аптека',/таблет|витамин|лекарств/,'💊']];
const classify=name=>groups.find(g=>g[1].test(name.toLowerCase().replaceAll('ё','е'))) || ['Прочее',null,'📦'];
const productIcon=name=>classify(name)[2];
let allItems=[], activeList='Продукты', page='Покупки', prefs={}, undoItem=null, metaReady=false;
const $=id=>document.getElementById(id), money=n=>Number(n||0).toLocaleString('ru-RU')+' ₽', cost=i=>Number(i.price||0), listOf=i=>i.list||'Продукты';
const meta=()=>doc(col('items'),'__premium_settings__');
function savePref(key,value){if(!ready||!metaReady)return;setDoc(meta(),{[key]:value},{merge:true}).catch(report);}
function refresh(){items=allItems.filter(i=>listOf(i)===activeList);render();updateRecommendations();if(page!=='Покупки')renderPage();}
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function btn(text,fn){const b=node('button',text);b.type='button';b.onclick=fn;return b;}
function editItem(i){const name=prompt('Название',i.name);if(!name?.trim())return;const qty=prompt('Количество / вес',i.qty||'');if(qty===null)return;const price=prompt('Стоимость всего товара, ₽',i.price??'');if(price===null)return;const note=prompt('Комментарий',i.note||'');if(note===null)return;const icon=prompt('Иконка (эмодзи, пусто — автоматически)',i.icon||'');if(icon===null)return;const n=Number(price.replace(',','.'));if(!Number.isFinite(n)||n<0){alert('Введите корректную цену');return;}updateDoc(itemDoc(i.id),{name:name.trim(),qty,price:n,note,icon}).catch(report);}
function celebrate(){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const layer=document.createElement('div');layer.className='confetti';layer.setAttribute('aria-hidden','true');
  for(let i=0;i<36;i++){const bit=document.createElement('i');bit.style.cssText=`--x:${Math.random()*100}vw;--d:${Math.random()*.6}s;--r:${Math.random()*720}deg;--c:${['#c5f76b','#fff','#77cdb0','#e8b76b'][i%4]}`;layer.append(bit);}
  document.body.append(layer);setTimeout(()=>layer.remove(),2300);
}
function render() {
  const bought=items.filter(i=>i.bought).length, pct=items.length?Math.round(bought/items.length*100):0;
  document.getElementById('progress-count').textContent=`${bought} из ${items.length}`;
  document.getElementById('progress-percent').textContent=pct+'%';
  document.getElementById('progress-ring').style.setProperty('--progress',pct+'%');
  document.getElementById('progress-bar').style.width=pct+'%';
  document.getElementById('remaining').textContent=`Осталось: ${items.length-bought}`;

  listEl.innerHTML = '';
  const total=items.reduce((s,i)=>s+cost(i),0), budget=Number(prefs["budget_"+activeList]||0); $("total").textContent="Корзина: "+money(total)+" · куплено "+money(items.filter(i=>i.bought).reduce((s,i)=>s+cost(i),0))+(budget?" · "+(total>budget?"Сверх бюджета: ":"Остаток: ")+money(Math.abs(budget-total)):"");

  // Показываем/скрываем кнопку завершения и текст "пусто"
  if (items.length === 0) {
    emptyMessage.classList.remove('hidden');
    finishBtn.classList.add('hidden');
  } else {
    emptyMessage.classList.add('hidden');
    finishBtn.classList.remove('hidden');
  }

  let lastCategory="";
  [...items].sort((a,b)=>classify(a.name)[0].localeCompare(classify(b.name)[0],"ru")||Number(a.bought)-Number(b.bought)).forEach(item => {
    const category=classify(item.name)[0];if(category!==lastCategory){listEl.append(node("li",category,"category"));lastCategory=category;}
    const li = document.createElement('li');
    li.className = 'list-item' + (item.bought ? ' bought' : '');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.bought;
    checkbox.setAttribute('aria-label', 'Отметить: '+item.name);
    checkbox.addEventListener('change', () => toggleBought(item.id));

    const span = document.createElement('span');
    span.className = 'item-text';
    span.textContent = item.name;

    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '✕';
    delBtn.title = 'Удалить';
    delBtn.addEventListener('click', () => deleteItem(item.id));

    const icon=document.createElement('span');icon.className='product-icon';icon.textContent=item.icon||productIcon(item.name);icon.setAttribute('aria-hidden','true');
    const details=document.createElement('div');details.className='item-details';details.append(span);
    const note=document.createElement('small');note.textContent=[item.qty,item.note,item.price?money(item.price):'',item.bought?'В корзине':''].filter(Boolean).join(' · ')||'Нужно купить';details.onclick=()=>editItem(item);details.tabIndex=0;details.onkeydown=e=>{if(e.key==='Enter')editItem(item)};details.append(note);
    li.append(icon,details,checkbox);
    li.appendChild(delBtn);
    listEl.appendChild(li);
  });
}

function updateRecommendations() {
  if (history.length === 0) {
    recBox.classList.add('hidden');
    return;
  }

  const counts = Object.create(null), dates = Object.create(null);
  history.forEach(list => {
    (list.items||[]).filter(i=>i.bought).forEach(item => {
      const name = item.name.toLowerCase();
      counts[name] = (counts[name] || 0) + 1; (dates[name] ||= []).push(Date.parse(list.date));
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
      const chip = document.createElement('button');
      chip.type='button';
      chip.className = 'rec-chip';
      chip.textContent = productIcon(item.name)+" "+item.name.charAt(0).toUpperCase() + item.name.slice(1); const ds=dates[item.name].filter(Number.isFinite).sort((a,b)=>a-b); if(ds.length>1){const avg=(ds.at(-1)-ds[0])/(ds.length-1);if(avg>0&&Date.now()-ds.at(-1)>=avg)chip.textContent+=" · пора?";}
      
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
  setDoc(ref, {name, bought:false, createdAt:Date.now(),list:activeList}).catch(report);
}
function toggleBought(id) {
  const item = items.find(i => i.id === id);
  if (ready && item) updateDoc(itemDoc(id), {bought:!item.bought}).catch(report);
}
function deleteItem(id) { if (ready) {undoItem=items.find(i=>i.id===id);$("undo").classList.remove("hidden");deleteDoc(itemDoc(id)).catch(report);} }
function finishShopping() {
  if (!ready || !items.length) return;
  if(items.some(i=>!i.bought)&&!confirm("Завершить только купленные товары? Остальные останутся в списке."))return;
  const purchased=items.filter(i=>i.bought);if(!purchased.length)return;
  if (items.length > 499) { say('Слишком много товаров для завершения за один раз.'); return; }
  const batch = writeBatch(db);
  batch.set(doc(col('history')), {date:new Date().toISOString(), items:purchased.map(i=>({...i}))});
  purchased.forEach(i=>batch.delete(itemDoc(i.id)));
  batch.commit().then(celebrate).catch(report);
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
  unsub.forEach(fn=>fn()); unsub=[]; ready=false; items=[]; allItems=[]; history=[]; prefs={};metaReady=false;
  login.classList.toggle('hidden',!!user); content.classList.toggle('hidden',!user);
  if(!user){say('Войдите один раз на этом устройстве.');return;}
  uid=user.uid; say('Загрузка списка…'); render(); updateRecommendations();
  unsub.push(onSnapshot(col('items'),{includeMetadataChanges:true},snap=>{
    allItems=snap.docs.filter(d=>d.id!=="__premium_settings__").map(d=>({...d.data(),id:d.id})).sort((a,b)=>a.createdAt-b.createdAt);prefs=snap.docs.find(d=>d.id==="__premium_settings__")?.data()||{};metaReady=true;ready=true;applyPrefs();
    say(snap.metadata.hasPendingWrites?'Ожидает синхронизации…':snap.metadata.fromCache?'Локальная копия · ожидаем связь':'Список синхронизирован'); refresh();
  },report));
  unsub.push(onSnapshot(col('history'),snap=>{history=snap.docs.map(d=>d.data());updateRecommendations();if(page!=="Покупки")renderPage();},report));
});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.error);

function applyPrefs(){document.documentElement.style.setProperty('--accent',prefs.accent||'#c5f76b');if(document.activeElement!==$('budget'))$('budget').value=prefs['budget_'+activeList]||'';}
$('budget').onchange=e=>savePref('budget_'+activeList,Math.max(0,Number(e.target.value)||0));
$('list-select').onchange=e=>{activeList=e.target.value;applyPrefs();refresh();};
$('undo').onclick=()=>{if(undoItem&&ready){const {id,...data}=undoItem;setDoc(itemDoc(id),data).catch(report);undoItem=null;$('undo').classList.add('hidden');}};
const pages=['Покупки','Запасы','Рецепты','Расходы','Настройки'];
function navigate(p){page=p;$('shopping-panel').classList.toggle('hidden',p!=='Покупки');$('other-panel').classList.toggle('hidden',p==='Покупки');[...$('tabs').children].forEach(b=>b.classList.toggle('active',b.textContent===p));if(p!=='Покупки')renderPage();}
pages.forEach(p=>$('tabs').append(btn(p,()=>navigate(p))));navigate('Покупки');
function renderPage(){const root=$('other-panel');root.replaceChildren(node('h1',page));const card=(title,detail,actions=[])=>{const c=node('div','','extra-card');c.append(node('h3',title),node('p',detail));actions.forEach(b=>c.append(b));root.append(c);};
if(page==='Запасы'){const stock=prefs.stock||[];root.append(btn('+ Добавить запас',()=>{const name=prompt('Продукт');if(!name?.trim())return;const qty=prompt('Количество','1');if(qty!==null)savePref('stock',[...stock,{name,qty,id:crypto.randomUUID()}]);}));stock.forEach(i=>card(productIcon(i.name)+' '+i.name,i.qty,[btn('В покупки',()=>addItem(i.name)),btn('Изменить',()=>{const q=prompt('Количество',i.qty);if(q!==null)savePref('stock',stock.map(x=>x.id===i.id?{...x,qty:q}:x));}),btn('Удалить',()=>savePref('stock',stock.filter(x=>x.id!==i.id)))]));}
if(page==='Рецепты'){const recipes=[{name:'Паста с томатами',ingredients:['Макароны','Помидоры','Чеснок','Сыр']},{name:'Омлет',ingredients:['Яйца','Молоко','Сыр']},{name:'Салат',ingredients:['Огурцы','Помидоры','Салат','Масло']},...(prefs.recipes||[])];root.append(btn('+ Свой рецепт',()=>{const name=prompt('Название');if(!name?.trim())return;const s=prompt('Ингредиенты через запятую');if(s?.trim())savePref('recipes',[...(prefs.recipes||[]),{name,ingredients:s.split(',').map(x=>x.trim()).filter(Boolean)}]);}));recipes.forEach(r=>card(r.name,r.ingredients.join(' · '),[btn('Добавить ингредиенты',()=>r.ingredients.forEach(addItem))]));}
if(page==='Расходы'){const sorted=[...history].sort((a,b)=>String(b.date).localeCompare(String(a.date)));for(const [label,days] of [['Неделя',7],['Месяц',30],['Год',365]]){const rows=sorted.filter(h=>Date.parse(h.date)>=Date.now()-days*86400000);card(label,money(rows.reduce((s,h)=>s+(h.items||[]).filter(i=>i.bought).reduce((v,i)=>v+cost(i),0),0)));}root.append(node('h2','История покупок'));sorted.forEach(h=>card(new Date(h.date).toLocaleDateString('ru-RU'),(h.items||[]).map(i=>i.name).join(', '),[btn('Повторить список',()=>{(h.items||[]).forEach(i=>addItem(i.name));navigate('Покупки');})]));root.append(node('p','Старые покупки без цен не учитываются в сумме.'));}
if(page==='Настройки'){card('Акцентный цвет','Выберите оформление',['#c5f76b','#82d9ff','#f8a8df','#ffc477'].map(c=>{const b=btn(c,()=>savePref('accent',c));b.style.background=c;b.style.color='#111';return b;}));const fav=prefs.favorites||[];card('Избранное','Быстрое добавление',[btn('+ Добавить любимый товар',()=>{const n=prompt('Название');if(n?.trim())savePref('favorites',[...new Set([...fav,n.trim()])]);})]);fav.forEach(n=>card(productIcon(n)+' '+n,'',[btn('В покупки',()=>addItem(n)),btn('Удалить',()=>savePref('favorites',fav.filter(x=>x!==n)))]));card('Напоминания','Работают, пока приложение открыто.',[btn('Установить напоминание',()=>{const n=Number(prompt('Через сколько минут напомнить?','30'));if(n>0&&n<=1440)setTimeout(()=>alert('Пора проверить список покупок!'),n*60000);})]);card('Чеки','Вставьте распознанный текст чека вручную (например, из функции Live Text на iPhone).',[btn('Импорт текста',()=>{const t=prompt('Товары: каждый с новой строки или через запятую');if(t)t.split(/[,\n]/).map(x=>x.trim()).filter(Boolean).forEach(addItem);})]);}}
$('voice').onclick=()=>{const R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R){alert('Голосовой ввод недоступен. Используйте микрофон клавиатуры.');return;}try{const r=new R();r.lang='ru-RU';r.onresult=e=>e.results[0][0].transcript.split(/[,;]/).forEach(addItem);r.onerror=()=>alert('Не удалось распознать голос.');r.start();}catch(e){alert('Голосовой ввод недоступен.');}};
