<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import api from './api.js'

const daftarAntrian = ref([])
const loading = ref(false)
const sedangMemproses = ref(false)
const error = ref('')
const pesan = ref('')
const namaToko = ref('Antrian Digital')
const namaTokoInput = ref(namaToko.value)
const deskripsiToko = ref('Layanan lebih mudah, antre lebih nyaman')
const deskripsiTokoInput = ref(deskripsiToko.value)
const whatsappSendingId = ref(null)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const savingPassword = ref(false)
const passwordMessage = ref('')
const passwordError = ref('')
const linkPelanggan = window.location.origin + '/'
const qrUrl = computed(() => `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(linkPelanggan)}`)
let intervalRefresh = null

const menunggu = computed(() => daftarAntrian.value.filter(x => x.status === 'waiting'))
const sedangDilayani = computed(() => daftarAntrian.value.find(x => x.status === 'serving') || null)
const selesai = computed(() => daftarAntrian.value.filter(x => x.status === 'done'))
const rataRataMenunggu = computed(() => {
  const durasi = selesai.value.map(x => {
    if (!x.dipanggil_pada || !x.selesai_pada) return null
    return (new Date(x.selesai_pada) - new Date(x.dipanggil_pada)) / 60000
  }).filter(x => x !== null && Number.isFinite(x) && x >= 0)
  return durasi.length ? (durasi.reduce((a, b) => a + b, 0) / durasi.length).toFixed(0) : '3'
})
function formatNomor(nomor) { return `A-${String(nomor).padStart(3, '0')}` }
function labelStatus(status) { return ({ waiting: 'Menunggu', serving: 'Sedang dilayani', done: 'Selesai', skipped: 'Dilewati', cancelled: 'Dibatalkan' })[status] || status }
function formatTanggal(tanggal) { return tanggal ? new Date(tanggal).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '—' }

async function muatPengaturanToko() {
  try {
    const response = await api.get('/pengaturan')
    const data = response.data?.data || {}
    namaToko.value = data.nama_toko || 'Antrian Digital'
    namaTokoInput.value = namaToko.value
    deskripsiToko.value = data.deskripsi || ''
    deskripsiTokoInput.value = deskripsiToko.value
  } catch (e) {
    error.value = e.response?.data?.message || 'Gagal memuat pengaturan toko.'
  }
}

async function muatAntrian() {
  loading.value = true
  try {
    const response = await api.get('/antrian')
    daftarAntrian.value = Array.isArray(response.data.data) ? response.data.data : []
    error.value = ''
  } catch (e) {
    error.value = e.response?.data?.message || 'Gagal memuat data antrean. Periksa koneksi backend.'
  } finally { loading.value = false }
}
async function jalankanAksi(aksi, item = null) {
  if (sedangMemproses.value) return
  if (item && !window.confirm(`${aksi === 'selesaikan' ? 'Selesaikan' : 'Lewati'} antrean ${formatNomor(item.nomor)}?`)) return
  sedangMemproses.value = true; error.value = ''; pesan.value = ''
  try {
    let response
    if (aksi === 'panggil') response = await api.post('/antrian/panggil-berikutnya')
    if (aksi === 'selesaikan') response = await api.post(`/antrian/${item.id}/selesaikan`)
    if (aksi === 'lewati') response = await api.post(`/antrian/${item.id}/lewati`)
    pesan.value = response?.data?.message || 'Perubahan antrean berhasil disimpan.'
    await muatAntrian()
  } catch (e) {
    error.value = e.response?.data?.message || 'Aksi gagal. Silakan coba lagi.'
  } finally { sedangMemproses.value = false }
}
async function simpanPengaturan() {
  const nama = namaTokoInput.value.trim()
  const deskripsi = deskripsiTokoInput.value.trim()
  if (!nama) { error.value = 'Nama toko tidak boleh kosong.'; return }
  if (!deskripsi) { error.value = 'Deskripsi toko tidak boleh kosong.'; return }
  error.value = ''; pesan.value = ''; sedangMemproses.value = true
  try {
    const response = await api.put('/pengaturan', { nama_toko: nama, deskripsi })
    const data = response.data?.data || { nama_toko: nama, deskripsi }
    namaToko.value = data.nama_toko
    namaTokoInput.value = data.nama_toko
    deskripsiToko.value = data.deskripsi
    deskripsiTokoInput.value = data.deskripsi
    pesan.value = response.data?.message || 'Pengaturan toko berhasil disimpan.'
  } catch (e) {
    error.value = e.response?.data?.message || 'Gagal menyimpan pengaturan toko.'
  } finally { sedangMemproses.value = false }
}

async function ubahPassword() {
  passwordMessage.value = ''
  passwordError.value = ''
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Konfirmasi password baru tidak cocok.'
    return
  }
  if (newPassword.value.length < 8) {
    passwordError.value = 'Password baru minimal 8 karakter.'
    return
  }
  savingPassword.value = true
  try {
    const response = await api.put('/account/password', {
      current_password: currentPassword.value,
      password: newPassword.value,
      password_confirmation: confirmPassword.value,
    })
    passwordMessage.value = response.data?.message || 'Password berhasil diperbarui.'
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e) {
    const errors = e.response?.data?.errors
    passwordError.value = errors?.current_password?.[0] || errors?.password?.[0] || e.response?.data?.message || 'Password gagal diperbarui.'
  } finally {
    savingPassword.value = false
  }
}

async function kirimWhatsApp(item) {
  if (!item?.telepon) { error.value = 'Pelanggan ini belum memberikan nomor WhatsApp.'; return }
  if (whatsappSendingId.value) return
  if (!window.confirm(`Kirim pengingat WhatsApp ke ${item.nama || 'pelanggan'} (${formatNomor(item.nomor)})?`)) return
  whatsappSendingId.value = item.id; error.value = ''; pesan.value = ''
  try {
    const response = await api.post(`/antrian/${item.id}/whatsapp`)
    pesan.value = response.data?.message || 'Pesan WhatsApp berhasil dimasukkan ke antrean pengiriman.'
  } catch (e) {
    error.value = e.response?.data?.message || 'Gagal mengirim WhatsApp. Periksa token dan koneksi Fonnte.'
  } finally { whatsappSendingId.value = null }
}
async function salinLink() {
  try {
    await navigator.clipboard.writeText(linkPelanggan)
    pesan.value = 'Link pelanggan berhasil disalin.'; error.value = ''
  } catch (_) {
    window.prompt('Salin link pelanggan berikut:', linkPelanggan)
  }
}
function resetAntrian() {
  if (!window.confirm('Reset antrean membutuhkan endpoint khusus di backend. Lanjut melihat petunjuk?')) return
  error.value = 'Reset belum dijalankan: backend belum menyediakan endpoint reset antrean. Ini mencegah data terhapus tanpa dukungan server.'
  pesan.value = ''
}
async function logout() {
  try { await api.post('/logout') } catch (_) { /* token lokal tetap dihapus */ }
  localStorage.removeItem('admin_token'); localStorage.removeItem('antrian_token'); localStorage.removeItem('admin_user'); localStorage.removeItem('antrian_user')
  window.location.href = '/login'
}
onMounted(() => { muatPengaturanToko(); muatAntrian(); intervalRefresh = setInterval(muatAntrian, 5000) })
onUnmounted(() => { if (intervalRefresh) clearInterval(intervalRefresh) })
</script>

<template>
  <div class="admin-page">
    <header class="hero admin-hero">
      <div class="wrap wide">
        <div class="top">
          <div class="logo">{{ namaToko.slice(0, 1).toUpperCase() }}</div>
          <div class="brand-copy"><h1>{{ namaToko }}</h1><small>Dashboard penjual</small></div>
          <div class="sp"></div>
          <button class="btn ghost" @click="logout">Keluar</button>
        </div>
      </div>
    </header>

    <main class="main admin-main">
      <div class="wrap wide admin-layout">
        <div class="admin-column">
          <section class="card admin-serving-card">
            <div class="lbl">Sedang dilayani</div>
            <div class="admin-serving-number" :class="{ 'not-serving': !sedangDilayani }">{{ sedangDilayani ? formatNomor(sedangDilayani.nomor) : 'Belum ada' }}</div>
            <p class="serving-caption">{{ sedangDilayani ? (sedangDilayani.nama || 'Pelanggan') : 'Belum ada yang dipanggil' }}</p>
            <div class="admin-serving-actions">
              <button class="btn primary lg queue-action-primary" :disabled="sedangMemproses || menunggu.length === 0" @click="jalankanAksi('panggil')">{{ sedangMemproses ? 'Memproses...' : 'Panggil berikutnya' }}</button>
              <button class="btn whatsapp-main-action" :disabled="sedangMemproses || !sedangDilayani || !sedangDilayani.telepon || whatsappSendingId === sedangDilayani?.id" @click="sedangDilayani && kirimWhatsApp(sedangDilayani)">{{ whatsappSendingId === sedangDilayani?.id ? 'Mengirim WhatsApp...' : (sedangDilayani?.telepon ? 'Kirim WhatsApp ke pelanggan' : 'WhatsApp (nomor belum tersedia)') }}</button>
              <div class="acts-row">
                <button class="btn" :disabled="sedangMemproses || !sedangDilayani" @click="jalankanAksi('selesaikan', sedangDilayani)">Selesai</button>
                <button class="btn danger" :disabled="sedangMemproses || !sedangDilayani" @click="jalankanAksi('lewati', sedangDilayani)">Lewati (tidak hadir)</button>
              </div>
            </div>
          </section>

          <section class="stats admin-stats">
            <div class="stat"><b>{{ menunggu.length }}</b><span>Menunggu</span></div>
            <div class="stat"><b>{{ selesai.length }}</b><span>Selesai hari ini</span></div>
            <div class="stat"><b>{{ rataRataMenunggu }}</b><span>Menit / pelanggan</span></div>
          </section>

          <section class="card waiting-card">
            <div class="queue-meta"><h2>Daftar tunggu</h2><span class="pill">{{ menunggu.length }} antrean</span></div>
            <ul v-if="menunggu.length" class="admin-list">
              <li v-for="item in menunggu" :key="item.id">
                <span class="chip">{{ formatNomor(item.nomor) }}</span>
                <span class="admin-name"><strong>{{ item.nama || 'Tanpa nama' }}</strong><small>Terdaftar {{ formatTanggal(item.created_at) }}</small></span>
                <div class="admin-actions"><button class="btn primary sm" :disabled="sedangMemproses" @click="jalankanAksi('panggil')">Panggil</button><button class="btn danger sm" :disabled="sedangMemproses" @click="jalankanAksi('lewati', item)">Lewati</button></div>
              </li>
            </ul>
            <div v-else class="empty">{{ loading ? 'Memuat antrean...' : 'Belum ada pelanggan yang mengantre' }}</div>
          </section>
        </div>

        <aside class="admin-column side-column">
          <section class="card qr-card">
            <h2>QR &amp; link pelanggan</h2>
            <p class="muted">Cetak QR ini atau tulis link-nya ke kartu NFC.</p>
            <img class="customer-qr" :src="qrUrl" alt="QR code untuk membuka halaman pelanggan" loading="lazy" />
            <div class="url customer-url">{{ linkPelanggan }}</div>
            <button class="btn copy-btn" @click="salinLink">Salin link</button>
          </section>

          <section class="card settings-card">
            <h2>Pengaturan</h2>
            <form @submit.prevent="simpanPengaturan">
              <label for="nama-toko">Nama toko</label>
              <input id="nama-toko" v-model="namaTokoInput" maxlength="80" required />
              <label for="deskripsi-toko">Deskripsi toko</label>
              <textarea id="deskripsi-toko" v-model="deskripsiTokoInput" maxlength="240" rows="3" required placeholder="Contoh: Layanan lebih mudah, antre lebih nyaman"></textarea>
              <div class="settings-actions">
                <button class="btn primary" type="submit" :disabled="sedangMemproses">{{ sedangMemproses ? 'Menyimpan...' : 'Simpan pengaturan' }}</button>
              </div>
            </form>
            <p class="small-note settings-note">Nama dan deskripsi disimpan di database dan ditampilkan pada halaman pelanggan.</p>
          </section>

          <section class="card settings-card password-card">
            <h2>Keamanan akun</h2>
            <p class="muted">Ubah password admin. Password baru minimal 8 karakter.</p>
            <form class="password-form" @submit.prevent="ubahPassword">
              <label for="current-password">Password saat ini</label>
              <input id="current-password" v-model="currentPassword" type="password" autocomplete="current-password" required />
              <label for="new-password">Password baru</label>
              <input id="new-password" v-model="newPassword" type="password" autocomplete="new-password" minlength="8" required />
              <label for="confirm-password">Konfirmasi password baru</label>
              <input id="confirm-password" v-model="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
              <p v-if="passwordMessage" class="alert success" role="status">{{ passwordMessage }}</p>
              <p v-if="passwordError" class="alert error" role="alert">{{ passwordError }}</p>
              <button class="btn primary password-submit" type="submit" :disabled="savingPassword">{{ savingPassword ? 'Menyimpan...' : 'Ubah password' }}</button>
            </form>
          </section>

          <section class="card all-queue-card">
            <div class="queue-meta"><h2>Semua antrean hari ini</h2><button class="btn sm" :disabled="loading" @click="muatAntrian">↻ Refresh</button></div>
            <div class="table-wrapper">
              <table><thead><tr><th>Nomor</th><th>Nama / status</th><th>Waktu</th><th>Notifikasi</th></tr></thead>
                <tbody>
                  <tr v-for="item in daftarAntrian" :key="item.id"><td><strong>{{ formatNomor(item.nomor) }}</strong></td><td>{{ item.nama || 'Pelanggan' }}<br /><span class="status" :class="`status-${item.status}`">{{ labelStatus(item.status) }}</span><br /><small v-if="item.telepon">{{ item.telepon }}</small></td><td>{{ formatTanggal(item.created_at) }}</td><td><button v-if="item.telepon && ['serving', 'skipped'].includes(item.status)" class="btn sm" :disabled="whatsappSendingId === item.id" @click="kirimWhatsApp(item)">{{ whatsappSendingId === item.id ? 'Mengirim...' : 'Kirim WhatsApp' }}</button><span v-else class="small-note">{{ item.telepon ? 'Tersedia saat dipanggil/dilewati' : 'Tanpa nomor WA' }}</span></td></tr>
                  <tr v-if="!loading && !daftarAntrian.length"><td colspan="4" class="empty">Belum ada antrean hari ini.</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </aside>

        <div class="admin-messages"><p v-if="pesan" class="alert success" role="status">{{ pesan }}</p><p v-if="error" class="alert error" role="alert">{{ error }}</p></div>
        <footer class="foot admin-foot">{{ namaToko }} · Dashboard penjual · Data diperbarui otomatis setiap 5 detik</footer>
      </div>
    </main>
  </div>
</template>

<style scoped>
.admin-serving-actions{display:grid;gap:12px}
.admin-serving-actions .btn{min-height:54px;padding:14px 18px;font-weight:750;font-size:15px;border-radius:14px;opacity:1;transition:filter .15s,transform .15s}
.admin-serving-actions .btn:hover:not(:disabled){filter:brightness(.94);transform:translateY(-1px)}
.admin-serving-actions .btn:disabled{cursor:not-allowed;opacity:1;filter:saturate(.55);color:#526b67;background:#e2eeeb;border:1px solid #c9ddd8}
/* Tombol aktif */
.admin-serving-actions .queue-action-primary,
.admin-serving-actions .queue-action-primary:hover,
.admin-serving-actions .queue-action-primary:focus,
.admin-serving-actions .queue-action-primary:active {
  background-color: #0f766e !important;
  color: #ffffff !important;
  border: 1px solid #0f766e !important;
  opacity: 1 !important;
  filter: none !important;
  box-shadow: none !important;
}

/* Tombol nonaktif */
.admin-serving-actions .queue-action-primary:disabled {
  background-color: #b2dfdb !important;
  color: #ffffff !important;
  border: 1px solid #b2dfdb !important;
  opacity: 1 !important;
  filter: none !important;
  box-shadow: none !important;
  cursor: not-allowed !important;
}
.admin-serving-actions .whatsapp-main-action{background:#128c7e;color:#fff;border:1px solid #128c7e}
.admin-serving-actions .whatsapp-main-action:disabled{background:#e2eeeb;color:#627a75;border-color:#c9ddd8}
.admin-serving-actions .acts-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.admin-serving-actions .acts-row .btn{background:#e4f3ef;color:#08766d;border:1px solid #b8dcd4}
.admin-serving-actions .acts-row .btn.danger{background:#fff0f0;color:#c33e48;border-color:#ffd0d3}
.admin-serving-actions .acts-row .btn:disabled{background:#edf3f1;color:#7d928d;border-color:#dce7e3}
.password-form{display:grid;gap:9px}
.password-form label{margin-top:4px;font-size:13px;font-weight:700}
.password-form input{width:100%;min-width:0;min-height:46px;padding:12px 14px;border:1.5px solid var(--line);border-radius:12px;background:#fafdfc;color:var(--ink);font:inherit}
.password-form input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px #0f766e22}
.password-submit{justify-self:start;margin-top:5px}
.password-card .muted{margin-top:-5px}
@media(max-width:480px){.admin-serving-actions .acts-row{grid-template-columns:1fr}.admin-serving-actions .btn{min-height:50px}}
.admin-serving-number.not-serving{font-size:clamp(30px,4vw,44px);letter-spacing:0;overflow-wrap:anywhere}.settings-card textarea{width:100%;min-height:84px;padding:14px 16px;border:1.5px solid var(--line);border-radius:14px;background:#fafdfc;color:var(--ink);font:inherit;resize:vertical}.settings-card textarea:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px #0f766e22}.settings-card .settings-actions{margin-top:12px}
</style>
