/* Keuangan Saya v1.1 — 100% offline. Semua data disimpan di perangkat. */
const KEY = 'keuangan_v11';

const DEFAULT_CATS = {
  expense: [
    {name:'Makanan', subs:['Makan','Minum']},
    {name:'Transportasi', subs:['Bensin','Service','Sewa']},
    {name:'Tagihan', subs:['Internet']},
    {name:'Rokok', subs:['Cappuccino']},
    {name:'Jajan', subs:[]},
    {name:'Lainnya', subs:[]}
  ],
  income: [
    {name:'Gaji', subs:[]},
    {name:'Pendapatan', subs:[]},
    {name:'Lainnya', subs:[]}
  ]
};

const HINTS = {
  Makanan:['makan','nasi','bakso','mie','ayam','sate','soto','resto','warung'],
  Transportasi:['bensin','parkir','ojek','grab','gojek','tol','service','servis','sewa'],
  Tagihan:['internet','wifi','listrik','pdam','token','bpjs','tagihan'],
  Rokok:['rokok','cappuc','kopi'],
  Jajan:['jajan','snack','cemilan','es krim','boba'],
  Gaji:['gaji'],
  Pendapatan:['freelance','proyek','jual','komisi','bonus','fee']
};

const REPORT_CSS = `
.rpt{background:#fff;color:#1b1b1b;border-radius:14px;padding:18px;font-family:Georgia,'Times New Roman',serif;font-size:13px}
.rpt .rhead{border-bottom:2px solid #b8893b;padding-bottom:10px;margin-bottom:14px}
.rpt .rbrand{font-size:18px;font-weight:bold;color:#0f3d32}
.rpt .rsum{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rpt .rsum div{border:1px solid #e2dccd;border-radius:8px;padding:8px}
.rpt .rsum span{display:block;font-size:11px;color:#666}
.rpt .rsum b{font-size:14px}
.rpt h4{margin:16px 0 6px;color:#0f3d32;font-size:13px;border-left:3px solid #b8893b;padding-left:8px}
.rpt table{width:100%;border-collapse:collapse;font-size:12px}
.rpt th,.rpt td{border-bottom:1px solid #ebe6d8;padding:6px 4px;text-align:left;vertical-align:top}
.rpt th{background:#f6f1e3}
.rpt .r{text-align:right;white-space:nowrap}
.rpt .tot td{font-weight:bold;border-top:2px solid #333}
.rpt .income{color:#2e7d5b}
.rpt .expense{color:#b5452e}
.rpt .muted{color:#777;font-size:11px}
.rpt .foot{font-size:10px;color:#888;margin-top:16px}
`;

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const rp = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const toNum = v => Number(String(v).replace(/\D/g,'')) || 0;
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const fmtDate = s => parseISO(s).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
const groupBy = (list, fn) => { const m = {}; list.forEach(t => { const k = fn(t); m[k] = (m[k] || 0) + t.amount; }); return m; };

/* ---------- Data ---------- */
function loadDb(){
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.tx) && d.cats) return d;
  } catch(e) {}
  return {tx:[], cats: JSON.parse(JSON.stringify(DEFAULT_CATS))};
}
let db = loadDb();
function persist(){ try { localStorage.setItem(KEY, JSON.stringify(db)); } catch(e) {} }

/* ---------- State ---------- */
const P = {mode:'harian', ref:new Date()};
const editing = {expense:null, income:null};
const catTouched = {expense:false, income:false};
let armed = null;
let toastTimer = null;

/* ---------- Periode ---------- */
function range(){
  const r = P.ref, y = r.getFullYear(), m = r.getMonth(), d = r.getDate();
  if (P.mode === 'harian') return [new Date(y,m,d), new Date(y,m,d)];
  if (P.mode === 'mingguan') { const off = (r.getDay()+6)%7; return [new Date(y,m,d-off), new Date(y,m,d-off+6)]; }
  return [new Date(y,m,1), new Date(y,m+1,0)];
}
function labelOf(){
  const [s,e] = range();
  if (P.mode === 'bulanan') return s.toLocaleDateString('id-ID',{month:'long',year:'numeric'});
  const f = d => d.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'});
  return P.mode === 'harian' ? f(s) : f(s) + ' – ' + f(e);
}
function shift(n){
  const r = P.ref, y = r.getFullYear(), m = r.getMonth(), d = r.getDate();
  if (P.mode === 'harian') P.ref = new Date(y,m,d+n);
  else if (P.mode === 'mingguan') P.ref = new Date(y,m,d+7*n);
  else P.ref = new Date(y,m+n,1);
}
function days(){ const [s,e] = range(); return Math.round((e-s)/86400000) + 1; }
function byNewest(a,b){ return b.date.localeCompare(a.date) || (b.createdAt||0) - (a.createdAt||0); }
function periodTx(){
  const [s,e] = range(), S = iso(s), E = iso(e);
  return db.tx.filter(t => t.date >= S && t.date <= E).sort(byNewest);
}
function sums(list){
  let inc = 0, out = 0;
  list.forEach(t => { if (t.kind === 'income') inc += t.amount; else out += t.amount; });
  return {inc, out, bal: inc - out};
}
function carry(){ const S = iso(range()[0]); return sums(db.tx.filter(t => t.date < S)).bal; }
function inRangeDate(s){ const [a,b] = range(); return s >= iso(a) && s <= iso(b); }

/* ---------- HTML bangun layar ---------- */
function periodHTML(){
  return `<div class="pbar">
    <div class="seg">
      <button data-period="harian">Harian</button>
      <button data-period="mingguan">Mingguan</button>
      <button data-period="bulanan">Bulanan</button>
    </div>
    <div class="pnav">
      <button data-nav="-1">‹</button>
      <span class="plabel"></span>
      <button data-nav="1">›</button>
    </div></div>`;
}
function formHTML(k){
  const title = k === 'expense' ? 'Pengeluaran' : 'Pemasukan';
  return `
  <div class="card">
    <div class="ftitle" id="${k}-ftitle">Catat ${title}</div>
    <label class="lab">Jumlah</label>
    <input class="amount" id="${k}-amt" inputmode="numeric" placeholder="0" autocomplete="off">
    <div class="row2">
      <div><label class="lab">Kategori</label><select id="${k}-cat"></select></div>
      <div><label class="lab">Sub</label><select id="${k}-sub"></select></div>
    </div>
    <div class="links">
      <button class="link" data-show="${k}-addcat">+ Tambah kategori</button>
      <button class="link" data-show="${k}-addsub">+ Tambah sub</button>
    </div>
    <div class="addbox hide" id="${k}-addcat">
      <input id="${k}-newcat" placeholder="Nama kategori baru" autocomplete="off">
      <button class="mini" data-addcat="${k}">Tambah</button>
    </div>
    <div class="addbox hide" id="${k}-addsub">
      <input id="${k}-newsub" placeholder="Nama sub baru" autocomplete="off">
      <button class="mini" data-addsub="${k}">Tambah</button>
    </div>
    <label class="lab">Keterangan</label>
    <input id="${k}-note" placeholder="Contoh: makan siang di warung" autocomplete="off">
    <label class="lab">Tanggal</label>
    <input type="date" id="${k}-date">
    <button class="save" data-save="${k}">Simpan</button>
    <button class="ghost hide" id="${k}-cancel" data-cancel="${k}">Batal edit</button>
  </div>
  ${periodHTML()}
  <div class="card total" id="${k}-total"></div>
  <div class="card"><div class="ctitle">Per kategori</div><div id="${k}-brk"></div></div>
  <div class="card"><div class="ctitle">Riwayat</div><div id="${k}-list"></div></div>`;
}

/* ---------- Kategori ---------- */
function fillSubs(k, keepSub){
  const c = db.cats[k].find(x => x.name === $(k+'-cat').value);
  const subs = c ? c.subs : [];
  $(k+'-sub').innerHTML = `<option value="">— tanpa sub —</option>` + subs.map(s => `<option>${esc(s)}</option>`).join('');
  if (keepSub && subs.includes(keepSub)) $(k+'-sub').value = keepSub;
}
function fillCats(k, keepCat, keepSub){
  const cats = db.cats[k];
  $(k+'-cat').innerHTML = cats.map(c => `<option>${esc(c.name)}</option>`).join('');
  if (keepCat && cats.some(c => c.name === keepCat)) $(k+'-cat').value = keepCat;
  fillSubs(k, keepSub);
}
function addCat(k){
  const inp = $(k+'-newcat'), n = inp.value.trim();
  if (!n) return;
  let c = db.cats[k].find(x => x.name.toLowerCase() === n.toLowerCase());
  if (!c) { c = {name:n, subs:[]}; db.cats[k].push(c); persist(); }
  inp.value = '';
  $(k+'-addcat').classList.add('hide');
  catTouched[k] = true;
  fillCats(k, c.name);
  toast('Kategori ditambahkan');
}
function addSub(k){
  const inp = $(k+'-newsub'), n = inp.value.trim();
  if (!n) return;
  const c = db.cats[k].find(x => x.name === $(k+'-cat').value);
  if (!c) { toast('Pilih kategori dulu'); return; }
  if (!c.subs.some(s => s.toLowerCase() === n.toLowerCase())) { c.subs.push(n); persist(); }
  inp.value = '';
  $(k+'-addsub').classList.add('hide');
  fillSubs(k, n);
  toast('Sub ditambahkan');
}

/* Otomatis: kategori & sub dari keterangan */
function hint(k){
  if (catTouched[k]) return;
  const text = ($(k+'-note').value || '').toLowerCase();
  if (!text) return;
  const cats = db.cats[k];
  for (const [cat, words] of Object.entries(HINTS)) {
    if (words.some(w => text.includes(w)) && cats.some(c => c.name === cat)) {
      $(k+'-cat').value = cat; fillSubs(k); break;
    }
  }
  const c = cats.find(x => x.name === $(k+'-cat').value);
  if (c) { const s = c.subs.find(sb => text.includes(sb.toLowerCase())); if (s) $(k+'-sub').value = s; }
}

/* ---------- Form ---------- */
function resetForm(k){
  editing[k] = null;
  $(k+'-amt').value = '';
  $(k+'-note').value = '';
  $(k+'-date').value = iso(new Date());
  $(k+'-ftitle').textContent = 'Catat ' + (k === 'expense' ? 'Pengeluaran' : 'Pemasukan');
  $(k+'-cancel').classList.add('hide');
  document.querySelector(`[data-save="${k}"]`).textContent = 'Simpan';
  catTouched[k] = false;
  fillCats(k);
}
function saveForm(k){
  const amount = toNum($(k+'-amt').value);
  if (!amount) { toast('Isi jumlah dulu'); return; }
  const cat = $(k+'-cat').value;
  if (!cat) { toast('Pilih kategori'); return; }
  const rec = {
    kind: k, amount, cat,
    sub: $(k+'-sub').value || '',
    note: $(k+'-note').value.trim(),
    date: $(k+'-date').value || iso(new Date())
  };
  if (editing[k]) {
    const t = db.tx.find(x => x.id === editing[k]);
    if (t) Object.assign(t, rec);
    toast('Perubahan tersimpan');
  } else {
    rec.id = uid(); rec.createdAt = Date.now();
    db.tx.push(rec);
    toast('Tersimpan otomatis');
  }
  persist();
  if (!inRangeDate(rec.date)) P.ref = parseISO(rec.date);
  resetForm(k);
  render();
}
function startEdit(id){
  const t = db.tx.find(x => x.id === id);
  if (!t) return;
  const k = t.kind;
  editing[k] = id;
  show(k === 'expense' ? 's-out' : 's-in');
  $(k+'-amt').value = t.amount.toLocaleString('id-ID');
  $(k+'-note').value = t.note || '';
  $(k+'-date').value = t.date;
  $(k+'-ftitle').textContent = 'Edit ' + (k === 'expense' ? 'Pengeluaran' : 'Pemasukan');
  document.querySelector(`[data-save="${k}"]`).textContent = 'Perbarui';
  $(k+'-cancel').classList.remove('hide');
  fillCats(k, t.cat, t.sub);
  catTouched[k] = true;
  window.scrollTo(0,0);
}
function deleteTx(id){
  if (armed !== id) {
    armed = id; render();
    setTimeout(() => { if (armed === id) { armed = null; render(); } }, 3000);
    return;
  }
  db.tx = db.tx.filter(t => t.id !== id);
  armed = null;
  persist();
  if (editing.expense === id) resetForm('expense');
  if (editing.income === id) resetForm('income');
  render();
  toast('Catatan dihapus');
}

/* ---------- Render ---------- */
function renderKind(k){
  const list = periodTx().filter(t => t.kind === k);
  const total = list.reduce((a,t) => a + t.amount, 0);
  $(k+'-total').innerHTML = `<span>Total ${k === 'expense' ? 'pengeluaran' : 'pemasukan'} · ${esc(labelOf())}</span>
    <b>${rp(total)}</b><small>${list.length} catatan</small>`;
  const rows = Object.entries(groupBy(list, t => t.cat)).sort((a,b) => b[1] - a[1]);
  $(k+'-brk').innerHTML = rows.length
    ? rows.map(([n,v]) => {
        const pct = total ? Math.round(v/total*100) : 0;
        return `<div class="bar"><div class="bl"><span>${esc(n)}</span><span>${rp(v)} · ${pct}%</span></div>
                <div class="track"><i style="width:${pct}%"></i></div></div>`;
      }).join('')
    : '<p class="muted">Belum ada data pada periode ini.</p>';
  $(k+'-list').innerHTML = list.length
    ? list.map(t => `<div class="item">
        <div class="meta" data-edit="${t.id}">
          <b>${esc(t.note || t.cat)}</b>
          <small>${esc(t.cat)}${t.sub ? ' · ' + esc(t.sub) : ''} · ${fmtDate(t.date)}</small>
        </div>
        <div class="amt">${rp(t.amount)}</div>
        <button class="del ${armed === t.id ? 'armed' : ''}" data-del="${t.id}">${armed === t.id ? 'Hapus?' : '✕'}</button>
      </div>`).join('')
    : '<p class="muted">Belum ada catatan pada periode ini.</p>';
}

function reportBody(){
  const list = periodTx(), sm = sums(list), saldoAwal = carry();
  const title = P.mode === 'harian' ? 'Harian' : P.mode === 'mingguan' ? 'Mingguan' : 'Bulanan';
  const tbl = kind => {
    const map = {};
    list.filter(t => t.kind === kind).forEach(t => {
      const key = t.cat + '|' + (t.sub || '-');
      map[key] = map[key] || {cat:t.cat, sub:t.sub || '-', v:0};
      map[key].v += t.amount;
    });
    const arr = Object.values(map).sort((a,b) => b.v - a.v);
    if (!arr.length) return '<p class="muted">Tidak ada data.</p>';
    const total = arr.reduce((a,r) => a + r.v, 0);
    return `<table><thead><tr><th>Kategori</th><th>Sub</th><th class="r">Jumlah</th></tr></thead><tbody>
      ${arr.map(r => `<tr><td>${esc(r.cat)}</td><td>${esc(r.sub)}</td><td class="r">${rp(r.v)}</td></tr>`).join('')}
      <tr class="tot"><td colspan="2">Total</td><td class="r">${rp(total)}</td></tr></tbody></table>`;
  };
  const detail = list.length
    ? `<table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Kategori / Sub</th><th>Keterangan</th><th class="r">Jumlah</th></tr></thead><tbody>
      ${list.slice().reverse().map(t => `<tr><td>${fmtDate(t.date)}</td><td>${t.kind === 'income' ? 'Pemasukan' : 'Pengeluaran'}</td>
        <td>${esc(t.cat)}${t.sub ? ' / ' + esc(t.sub) : ''}</td><td>${esc(t.note)}</td>
        <td class="r ${t.kind}">${t.kind === 'income' ? '+' : '−'}${rp(t.amount)}</td></tr>`).join('')}
      </tbody></table>`
    : '<p class="muted">Tidak ada transaksi.</p>';
  return `<div class="rpt">
    <div class="rhead">
      <div class="rbrand">Keuangan Saya</div>
      <div>Laporan ${title}</div>
      <div class="muted">${esc(labelOf())}</div>
    </div>
    <div class="rsum">
      <div><span>Saldo awal</span><b>${rp(saldoAwal)}</b></div>
      <div><span>Total pemasukan</span><b class="income">${rp(sm.inc)}</b></div>
      <div><span>Total pengeluaran</span><b class="expense">${rp(sm.out)}</b></div>
      <div><span>Saldo akhir</span><b>${rp(saldoAwal + sm.bal)}</b></div>
    </div>
    <h4>Pengeluaran</h4>${tbl('expense')}
    <h4>Pemasukan</h4>${tbl('income')}
    <h4>Rincian transaksi</h4>${detail}
    <div class="foot">Dibuat ${new Date().toLocaleString('id-ID')} · Keuangan Saya v1.1</div>
  </div>`;
}

function renderAdvice(){
  const list = periodTx(), s = sums(list);
  const per = P.mode === 'harian' ? 'hari ini' : P.mode === 'mingguan' ? 'minggu ini' : 'bulan ini';
  const tips = [];
  if (!list.length) {
    tips.push(['', `Belum ada catatan ${per}. Mulai catat agar nasihat bisa disesuaikan dengan kondisi keuangan Anda.`]);
  } else {
    if (s.inc > 0) {
      const pct = Math.round(s.bal / s.inc * 100);
      if (s.bal < 0) tips.push(['warn', `Pengeluaran melebihi pemasukan ${per} sebesar ${rp(-s.bal)}. Tunda belanja yang tidak mendesak dan tinjau kategori terbesar.`]);
      else if (pct >= 20) tips.push(['good', `Anda menyisihkan ${pct}% dari pemasukan ${per}. Sudah di atas target 20%. Pertahankan.`]);
      else tips.push(['warn', `Sisa dana ${per} baru ${pct}% dari pemasukan. Targetkan minimal 20% untuk tabungan.`]);
    } else if (s.out > 0) {
      tips.push(['warn', `Belum ada pemasukan tercatat ${per}, tetapi pengeluaran sudah ${rp(s.out)}. Pastikan pemasukan sudah dicatat.`]);
    }
    const cat = groupBy(list.filter(t => t.kind === 'expense'), t => t.cat);
    const top = Object.entries(cat).sort((a,b) => b[1] - a[1])[0];
    if (top && s.out > 0) {
      const sh = Math.round(top[1] / s.out * 100);
      tips.push([sh >= 40 ? 'warn' : '', `Pengeluaran terbesar ${per} ada di ${top[0]}: ${rp(top[1])} (${sh}%).${sh >= 40 ? ' Tetapkan batas anggaran untuk kategori ini.' : ''}`]);
    }
    const rokok = cat['Rokok'] || 0;
    if (rokok > 0 && s.out > 0 && rokok / s.out >= 0.10) {
      const setahun = Math.round(rokok / days() * 365);
      tips.push(['warn', `Rokok dan kopi memakan ${Math.round(rokok / s.out * 100)}% pengeluaran ${per}. Jika pola ini berlanjut, setahun bisa mencapai sekitar ${rp(setahun)}.`]);
    }
    const jajan = cat['Jajan'] || 0;
    if (jajan > 0 && s.out > 0 && jajan / s.out >= 0.15) {
      tips.push(['warn', `Jajan mencapai ${Math.round(jajan / s.out * 100)}% dari pengeluaran. Coba batasi jajan dengan anggaran mingguan.`]);
    }
    const cur = P.ref;
    shift(-1);
    const prev = sums(periodTx());
    P.ref = cur;
    if (prev.out > 0 && s.out > 0) {
      const d = Math.round((s.out - prev.out) / prev.out * 100);
      if (d >= 20) tips.push(['warn', `Pengeluaran naik ${d}% dibanding periode sebelumnya. Cek apakah ada belanja yang tidak rutin.`]);
      else if (d <= -20) tips.push(['good', `Pengeluaran turun ${-d}% dibanding periode sebelumnya. Kerja bagus.`]);
    }
    if (s.bal > 0) tips.push(['good', `Sisa ${rp(s.bal)} ${per}. Pindahkan sebagian ke tabungan terpisah agar tidak mudah terpakai.`]);
    if (carry() + s.bal < 0) tips.push(['warn', 'Saldo akhir keseluruhan negatif. Periksa apakah ada pemasukan yang belum tercatat.']);
  }
  tips.push(['', 'Acuan 50/30/20: 50% untuk kebutuhan, 30% untuk keinginan, dan 20% untuk tabungan atau dana darurat.']);
  tips.push(['', 'Dana darurat idealnya setara 3–6 bulan pengeluaran rutin.']);
  $('adv').innerHTML = tips.map(([k,t]) => `<div class="card adv ${k}"><p>${t}</p></div>`).join('');
}

function updatePeriodUI(){
  document.querySelectorAll('[data-period]').forEach(b => b.classList.toggle('on', b.dataset.period === P.mode));
  document.querySelectorAll('.plabel').forEach(el => el.textContent = labelOf());
}
function render(){
  updatePeriodUI();
  renderKind('expense');
  renderKind('income');
  $('rep-body').innerHTML = reportBody();
  renderAdvice();
}

/* ---------- Navigasi & notifikasi ---------- */
function show(id){
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hide', s.id !== id));
  document.querySelectorAll('.bottom button').forEach(b => b.classList.toggle('on', b.dataset.go === id));
  window.scrollTo(0,0);
  render();
}
function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

/* ---------- Ekspor PDF ---------- */
function exportPdf(){
  const body = reportBody();
  const name = 'Laporan Keuangan ' + (P.mode === 'harian' ? 'Harian' : P.mode === 'mingguan' ? 'Mingguan' : 'Bulanan') + ' ' + labelOf();
  if (window.Android && typeof window.Android.printHtml === 'function') {
    const doc = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' + esc(name) +
      '</title><style>body{margin:0;padding:16px;background:#fff}' + REPORT_CSS + '</style></head><body>' + body + '</body></html>';
    window.Android.printHtml(doc, name);
    return;
  }
  $('printArea').innerHTML = body;
  window.print();
}

/* ---------- Event delegation ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('button, [data-edit]');
  if (!el) return;
  const d = el.dataset;
  if (d.go) return show(d.go);
  if (d.period) { P.mode = d.period; return render(); }
  if (d.nav) { shift(parseInt(d.nav, 10)); return render(); }
  if (d.show) { $(d.show).classList.toggle('hide'); return; }
  if (d.addcat) return addCat(d.addcat);
  if (d.addsub) return addSub(d.addsub);
  if (d.save) return saveForm(d.save);
  if (d.cancel) return resetForm(d.cancel);
  if (d.pdf) return exportPdf();
  if (d.del) return deleteTx(d.del);
  if (d.edit) return startEdit(d.edit);
});
document.addEventListener('input', e => {
  const id = e.target.id || '';
  if (id.endsWith('-amt')) {
    const n = toNum(e.target.value);
    e.target.value = n ? n.toLocaleString('id-ID') : '';
  } else if (id.endsWith('-note')) {
    hint(id.split('-')[0]);
  }
});
document.addEventListener('change', e => {
  const id = e.target.id || '';
  if (id.endsWith('-cat')) {
    const k = id.split('-')[0];
    catTouched[k] = true;
    fillSubs(k);
  }
});

/* ---------- Inisialisasi ---------- */
(function init(){
  const st = document.createElement('style');
  st.textContent = REPORT_CSS;
  document.head.appendChild(st);
  $('s-out').innerHTML = formHTML('expense');
  $('s-in').innerHTML = formHTML('income');
  $('s-rep').innerHTML = periodHTML() +
    `<div class="card"><div class="ctitle">Laporan</div><div id="rep-body"></div></div>
     <div class="card"><button class="save" data-pdf="1">Simpan sebagai PDF</button>
     <p class="muted">Pada menu cetak, pilih <b>Simpan sebagai PDF</b>. Data tetap tersimpan di perangkat.</p></div>`;
  $('s-adv').innerHTML = periodHTML() + `<div id="adv"></div>`;
  $('today').textContent = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long'});
  resetForm('expense');
  resetForm('income');
  render();
})();
