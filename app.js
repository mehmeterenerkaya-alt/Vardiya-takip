
const $=id=>document.getElementById(id);

let db,user,profile,employees=[],workdays=[],advances=[],payments=[];

const money=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY',maximumFractionDigits:2}).format(Number(n||0));
const dateNow=()=>new Date().toLocaleDateString('en-CA');

function msg(id,t){$(id).textContent=t}
function isManager(){return profile?.role==='manager'}

function escapeHtml(s=''){
 return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}

// TELEFON NUMARASINI E-POSTAYA DÖNÜŞTÜR
function phoneToEmail(phone){
 let number=String(phone).replace(/\D/g,'');

 if(number.startsWith('0')){
  number='90'+number.slice(1);
 }else if(number.startsWith('5')&&number.length===10){
  number='90'+number;
 }else if(!number.startsWith('90')){
  throw new Error('Geçerli bir Türkiye telefon numarası girin.');
 }

 if(!/^905\d{9}$/.test(number)){
  throw new Error('Telefon numarası 05XX XXX XX XX formatında olmalı.');
 }

 return number+'@vardiyatakip.app';
}

// UYGULAMA BAŞLAT
async function init(){

 if(!window.APP_CONFIG||APP_CONFIG.SUPABASE_URL.includes('SUPABASE_')){
  $('loginMsg').textContent='Önce config.js dosyasına Supabase bilgilerini ekleyin.';
  return;
 }

 db=window.supabase.createClient(
  APP_CONFIG.SUPABASE_URL,
  APP_CONFIG.SUPABASE_ANON_KEY
 );

 $('loginBtn').onclick=login;
 $('logout').onclick=logout;
 $('submitWork').onclick=submitWork;
 $('saveEmployee').onclick=saveEmployee;
 $('saveAdvance').onclick=saveAdvance;
 $('savePayment').onclick=savePayment;

 document.querySelectorAll('.tab').forEach(b=>{
  b.onclick=()=>showTab(b.dataset.tab);
 });

 $('monthPick').value=dateNow().slice(0,7);
 $('monthPick').onchange=()=>{
  renderCalendar();
  renderPayroll();
 };

 $('workDate').value=dateNow();
 $('advanceDate').value=dateNow();
 $('paymentDate').value=dateNow();

 const {data:{session}}=await db.auth.getSession();

 if(session){
  user=session.user;
  await loadApp();
 }
}

// TELEFON + ŞİFRE İLE GİRİŞ
async function login(){

 msg('loginMsg','Giriş yapılıyor…');

 let phone=$('phone').value.trim();
 let password=$('password').value;

 if(!phone||!password){
  return msg('loginMsg','Telefon ve şifre gerekli.');
 }

 let email;

 try{
  email=phoneToEmail(phone);
 }catch(error){
  return msg('loginMsg',error.message);
 }

 const {data,error}=await db.auth.signInWithPassword({
  email:email,
  password:password
 });

 if(error){
  return msg('loginMsg','Giriş başarısız: '+error.message);
 }

 user=data.user;
 await loadApp();
}

// ÇIKIŞ
async function logout(){
 await db.auth.signOut();
 location.reload();
}

// UYGULAMA YÜKLE
async function loadApp(){

 const {data:p,error}=await db.from('profiles')
  .select('*')
  .eq('id',user.id)
  .single();

 if(error){
  msg('loginMsg','Profil bulunamadı. Yönetici profil kaydınızı oluşturmalı.');
  return;
 }

 profile=p;

 $('login').classList.add('hidden');
 $('app').classList.remove('hidden');
 $('logout').classList.remove('hidden');

 $('hello').textContent='Merhaba, '+profile.full_name;

 $('roleLabel').textContent=isManager()
  ?'Yönetici + çalışan hesabı'
  :'Çalışan hesabı';

 document.querySelectorAll('.manager-only').forEach(e=>{
  e.classList.toggle('hidden',!isManager());
 });

 await refresh();
 showTab('overview');
}

// VERİLERİ YENİLE
async function refresh(){

 let q=db.from('profiles').select('*').eq('active',true).order('full_name');

 let w=db.from('workdays').select('*,profiles(full_name)').order('work_date',{ascending:false});

 let a=db.from('advances').select('*,profiles(full_name)').order('advance_date',{ascending:false});

 let p=db.from('salary_payments').select('*,profiles(full_name)').order('payment_date',{ascending:false});

 const [er,wr,ar,pr]=await Promise.all([q,w,a,p]);

 const failed=[er,wr,ar,pr].find(x=>x.error);

 if(failed){
  console.error(failed.error);
  alert('Veriler yüklenemedi: '+failed.error.message);
  return;
 }

 employees=er.data;
 workdays=wr.data;
 advances=ar.data;
 payments=pr.data;

 renderAll();
}

// TÜM EKRANLARI GÜNCELLE
function renderAll(){

 const month=dateNow().slice(0,7);

 let mine=workdays.filter(x=>
  x.user_id===user.id&&
  x.status==='approved'&&
  x.work_date.startsWith(month)
 );

 let earned=mine.reduce((s,x)=>
  s+Number(x.daily_rate||profile.daily_rate||0),0
 );

 let myAdv=advances.filter(x=>
  x.user_id===user.id&&
  x.advance_date.startsWith(month)
 ).reduce((s,x)=>s+Number(x.amount),0);

 let myPaid=payments.filter(x=>
  x.user_id===user.id&&
  x.payment_date.startsWith(month)
 ).reduce((s,x)=>s+Number(x.amount),0);

 $('myDays').textContent=mine.length;
 $('myEarned').textContent=money(earned);
 $('myAdvance').textContent=money(myAdv);
 $('myBalance').textContent=money(earned-myAdv-myPaid);

 $('recentMine').innerHTML=
  workdays.filter(x=>x.user_id===user.id)
  .slice(0,6).map(workRow).join('')||
  '<p class="muted">Henüz kayıt yok.</p>';

 if(isManager()){

  renderEmployees();
  renderApprovals();

  $('capacity').textContent=employees.length+' / 10';

  $('advanceEmployee').innerHTML=employees.map(e=>
   `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`
  ).join('');

  $('paymentEmployee').innerHTML=employees.map(e=>
   `<option value="${e.id}">${escapeHtml(e.full_name)}</option>`
  ).join('');
 }

 renderCalendar();
 renderPayroll();
}

// ÇALIŞMA KAYDI GÖRÜNÜMÜ
function workRow(x){

 return `<div class="record">
 <div>
 <b>${new Date(x.work_date+'T12:00:00').toLocaleDateString('tr-TR')}</b>
 <small>${escapeHtml(x.note||'Çalışma kaydı')}</small>
 </div>
 <span class="status ${x.status}">
 ${x.status==='approved'?'Onaylandı':x.status==='rejected'?'Reddedildi':'Onay bekliyor'}
 </span>
 </div>`;
}

// ÇALIŞMA GÜNÜ EKLE
async function submitWork(){

 let d=$('workDate').value;

 if(!d)return msg('workMsg','Tarih seç.');

 const {error}=await db.from('workdays').insert({
  user_id:user.id,
  work_date:d,
  note:$('workNote').value,
  status:'pending'
 });

 msg('workMsg',error
  ?'Kayıt eklenemedi: '+error.message
  :'Çalışma günün yönetici onayına gönderildi.'
 );

 if(!error){
  $('workNote').value='';
  await refresh();
 }
}

// PERSONEL LİSTESİ
function renderEmployees(){

 $('employeeList').innerHTML=employees.map(e=>
 `<div class="record">
 <div>
 <b>${escapeHtml(e.full_name)} ${e.id===user.id?'(Sen)':''}</b>
 <small>${escapeHtml(e.phone||'')} · ${money(e.daily_rate)} / gün · ${e.role==='manager'?'Yönetici':'Çalışan'}</small>
 </div>
 <button class="ghost" onclick="editRate('${e.id}',${Number(e.daily_rate||0)})">Ücreti düzenle</button>
 </div>`
 ).join('');
}

// PERSONEL EKLEME
async function saveEmployee(){

 if(employees.length>=10)
  return msg('empMsg','10 kişilik kapasite dolu.');

 let name=$('empName').value.trim();
 let phone=$('empPhone').value.trim();
 let rate=Number($('empRate').value);

 if(!name||!phone||rate<0)
  return msg('empMsg','Ad, telefon ve günlük ücret gerekli.');

 try{
  phoneToEmail(phone);
 }catch(error){
  return msg('empMsg',error.message);
 }

 msg('empMsg','Personel hesabı için güvenli sunucu tarafında hesap oluşturma işlemi henüz kurulmadı. Önce hesap oluşturulmalı, ardından profil bağlanmalıdır.');
}

// GÜNLÜK ÜCRET DÜZENLE
window.editRate=async(id,current)=>{

 let v=prompt('Yeni günlük ücret (₺):',current);

 if(v===null||!Number.isFinite(Number(v))||Number(v)<0)return;

 const {error}=await db.from('profiles')
  .update({daily_rate:Number(v)})
  .eq('id',id);

 if(error)alert(error.message);
 else await refresh();
};

// ONAY BEKLEYEN KAYITLAR
function renderApprovals(){

 let pending=workdays.filter(x=>x.status==='pending');

 $('pendingList').innerHTML=pending.map(x=>
 `<div class="record">
 <div>
 <b>${escapeHtml(x.profiles?.full_name||'Çalışan')}</b>
 <small>${x.work_date} · ${escapeHtml(x.note||'Not yok')}</small>
 </div>
 <div>
 <button class="primary" onclick="approve('${x.id}','approved')">Onayla</button>
 <button class="ghost" onclick="approve('${x.id}','rejected')">Reddet</button>
 </div>
 </div>`
 ).join('')||'<p class="muted">Bekleyen kayıt yok.</p>';
}

// ÇALIŞMA GÜNÜ ONAYLA / REDDET
window.approve=async(id,status)=>{

 let {error}=await db.from('workdays')
  .update({status})
  .eq('id',id);

 if(error)alert(error.message);
 else await refresh();
};

// MAAŞ HESAPLAMA
function payrollFor(e,month){

 let days=workdays.filter(x=>
  x.user_id===e.id&&
  x.status==='approved'&&
  x.work_date.startsWith(month)
 );

 let advs=advances.filter(x=>
  x.user_id===e.id&&
  x.advance_date.startsWith(month)
 );

 let pays=payments.filter(x=>
  x.user_id===e.id&&
  x.payment_date.startsWith(month)
 );

 let earned=days.reduce((s,x)=>
  s+Number(x.daily_rate??e.daily_rate??0),0
 );

 let advance=advs.reduce((s,x)=>s+Number(x.amount),0);
 let paid=pays.reduce((s,x)=>s+Number(x.amount),0);

 return {
  days:days.length,
  earned,
  advance,
  paid,
  balance:earned-advance-paid,
  advs,
  pays
 };
}

// MAAŞ LİSTESİ
function renderPayroll(){

 let month=$('monthPick').value||dateNow().slice(0,7);

 let visible=isManager()
  ?employees
  :employees.filter(e=>e.id===user.id);

 $('payrollList').innerHTML=visible.map(e=>{

  let p=payrollFor(e,month);

  return `<article class="pay-card">
  <div class="pay-head">
  <div>
  <b>${escapeHtml(e.full_name)} ${e.id===user.id?'(Sen)':''}</b>
  <small>${p.days} onaylı gün × ${money(e.daily_rate)} günlük ücret</small>
  </div>
  <strong class="${p.balance<=0?'paid':''}">${money(p.balance)}</strong>
  </div>

  <div class="pay-breakdown">
  <span>Hakediş <b>${money(p.earned)}</b></span>
  <span>Avans <b>−${money(p.advance)}</b></span>
  <span>Ödenen maaş <b>−${money(p.paid)}</b></span>
  </div>

  <div class="history">
  <b>Avans geçmişi</b>

  ${p.advs.map(a=>
   `<div class="history-row">
   <span>${a.advance_date} · ${escapeHtml(a.note||'Avans')}</span>
   <b>${money(a.amount)}</b>
   </div>`
  ).join('')||'<small class="muted">Avans kaydı yok.</small>'}

  <b>Maaş ödeme geçmişi</b>

  ${p.pays.map(a=>
   `<div class="history-row">
   <span>${a.payment_date} · ${escapeHtml(a.note||'Maaş ödemesi')}</span>
   <b>${money(a.amount)}</b>
   </div>`
  ).join('')||'<small class="muted">Maaş ödemesi yok.</small>'}

  </div>
  </article>`;

 }).join('')||'<p class="muted">Gösterilecek kayıt yok.</p>';
}

// AVANS EKLE
async function saveAdvance(){

 let uid=$('advanceEmployee').value;
 let amount=Number($('advanceAmount').value);
 let d=$('advanceDate').value;

 if(!uid||amount<=0||!d)
  return msg('advanceMsg','Çalışan, tutar ve tarih gerekli.');

 let {error}=await db.from('advances').insert({
  user_id:uid,
  amount,
  advance_date:d,
  note:$('advanceNote').value,
  created_by:user.id
 });

 msg('advanceMsg',error
  ?'Eklenemedi: '+error.message
  :'Avans kaydedildi.'
 );

 if(!error){
  $('advanceAmount').value='';
  $('advanceNote').value='';
  await refresh();
 }
}

// MAAŞ ÖDEMESİ EKLE
async function savePayment(){

 let uid=$('paymentEmployee').value;
 let amount=Number($('paymentAmount').value);
 let d=$('paymentDate').value;

 if(!uid||amount<=0||!d)
  return msg('paymentMsg','Çalışan, tutar ve ödeme tarihi gerekli.');

 let {error}=await db.from('salary_payments').insert({
  user_id:uid,
  amount,
  payment_date:d,
  note:$('paymentNote').value,
  created_by:user.id
 });

 msg('paymentMsg',error
  ?'Ödeme kaydedilemedi: '+error.message
  :'Maaş ödemesi kaydedildi; kalan bakiye güncellendi.'
 );

 if(!error){
  $('paymentAmount').value='';
  $('paymentNote').value='';
  await refresh();
 }
}

// TAKVİM
function renderCalendar(){

 if(!db)return;

 let [y,m]=($('monthPick').value||dateNow().slice(0,7))
  .split('-').map(Number);

 let first=new Date(y,m-1,1);
 let offset=(first.getDay()+6)%7;
 let days=new Date(y,m,0).getDate();

 let mine=workdays.filter(x=>isManager()||x.user_id===user.id);

 let html=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']
  .map(x=>`<div class="day head">${x}</div>`).join('');

 for(let i=0;i<offset;i++)html+='<div></div>';

 for(let d=1;d<=days;d++){

  let key=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

  let rows=mine.filter(x=>x.work_date===key);

  html+=`<div class="day ${rows.some(x=>x.status==='approved')?'marked':''}">
  ${d}${rows.length?'<div class="dot"></div>':''}
  </div>`;
 }

 $('calendarGrid').innerHTML=html;

 $('calendarList').innerHTML=mine.filter(x=>
  x.work_date.startsWith(`${y}-${String(m).padStart(2,'0')}`)
 ).map(workRow).join('')||
 '<p class="muted">Bu ay kayıt yok.</p>';
}

// SEKME DEĞİŞTİR
function showTab(tab){

 document.querySelectorAll('.view').forEach(v=>
  v.classList.toggle('hidden',v.id!==tab)
 );

 document.querySelectorAll('.tab').forEach(b=>
  b.classList.toggle('active',b.dataset.tab===tab)
 );

 if(tab==='payroll')renderPayroll();
}

// BAŞLAT
init();
